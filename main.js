#!/usr/bin/env node --harmony

/*=====================================================
                    IMPORTS / SETUP
======================================================*/
const _ = require('lodash')
const os = require('os')
const fs = require('fs')
const path = require('path');
const yaml = require('js-yaml')
const shell = require('shelljs')
const program = require('commander')
const logUpdate = require('log-update')
const fork = require('child_process').fork;

const {
  showLoading,
  errMsg,
  infoMsg,
  appendToFile
} = require('./helpers')

const {
  TMP_DIR_PATH,
  END_OF_FRAME_ID
} = require('./constants')

program
  .version('0.1.2')
  .command('create <input-video> <output-filename>')
  .description(
    'Takes an input video, converts it into ASCII frames, and writes it to an output file.'
  )
  .action(async (video, outputTo) => {
    if (!_.endsWith(outputTo, '.yaml')) {
      return console.log(errMsg('The outputfile must be a yaml file.'))
    }

    // remove the output file if it exists already
    if (fs.existsSync(outputTo)) {
      fs.unlinkSync(outputTo)
    }

    const dir = process.cwd()
    const finishLoadingId = showLoading()

    // make temp directory to write image files to
    shell.exec(`cd /tmp && mkdir __sprite_cli_output && cd ${dir}`)

    if (
      shell.exec(`ffmpeg -i ${program.args[0]} ${TMP_DIR_PATH}image%d.jpg`)
        .code !== 0
    ) {
      // stop loading animation
      clearInterval(finishLoadingId)
      return console.log(errMsg('@todo: error message for shit went wrong.'))
    }

    // stop loading animation
    clearInterval(finishLoadingId)

    // ensure frames are in correct order
    const files = fs
      .readdirSync(TMP_DIR_PATH)
      .sort((f1, f2) => {
        try {
          const fileOne = parseInt(f1.match(/\d/g).join(''))
          const fileTwo = parseInt(f2.match(/\d/g).join(''))
          return fileTwo - (fileOne + 1)
        } catch (e) {
          return 0
        }
      })
      .reverse()

    await createSprites(files, outputTo)
  })

program
  .command('play <file>')
  .description('Plays back a generated sprite file')
  .option(
    '-f, --frame_rate <rate>',
    'A number which specifies the rate at which to iterate through the sprites'
  )
  .action((pathToFile, opts) => {
    console.log(pathToFile)
    const lineReader = require('readline').createInterface({
      input: require('fs').createReadStream(pathToFile),
    })

    let frame = ''
    const re = RegExp(END_OF_FRAME_ID, 'g')
    const frameRate = opts && opts.frame_rate ? opts.frame_rate : 155

    lineReader.on('line', async line => {
      lineReader.pause()
      const fragment = yaml.safeLoad(line)[0]
      frame += fragment

      if (re.test(frame)) {
        const frames = frame.split(END_OF_FRAME_ID)
        for (let frameItem of frames) {
          await delay(frameRate)
          if (frameItem.length) logUpdate(frameItem)
        }

        frame = ''
      }

      lineReader.resume()
    })
  })

program.parse(process.argv)
if (!program.args.length) program.help()

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

async function createSprites(files, outputTo) {
  let spritesProcessed = 0
  const cpuCount = os.cpus().length
  const batches = _.chunk(files, cpuCount)
  const workerPath = path.join(__dirname, 'img-to-ascii-worker.js')
  const workers = []

  for (let i = 0; i < cpuCount; i++) {
    workers.push(fork(workerPath))
  }

  for (let batchId = 0; batchId < batches.length; batchId++) {
    const batch = batches[batchId]
    const promises = []

    for (let j = 0; j < batch.length; j++) {
      const worker = workers[j]

      promises.push(new Promise(resolve => {
        worker.on('message', result => {
          resolve(result)
          worker.removeAllListeners('message')
        })
        worker.send(batch[j])
      }))
    }

    const sprites = await Promise.all(promises)
    spritesProcessed += sprites.length
    appendToFile(outputTo, sprites)

    logUpdate(
      `Creating sprites: ${Math.round(spritesProcessed / files.length * 100)}%`
    )
  }

  for (let workerId = 0; workerId < workers.length; workerId++) {
    process.kill(workers[workerId].pid)
  }

  // clean up temp directory after the last chunk of sprites is written
  shell.exec(`rm -rf ${TMP_DIR_PATH}`)
  console.log(infoMsg(`File written to ${outputTo}`))
}
