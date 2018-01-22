const fs = require('fs')
const yaml = require('js-yaml')
const clc = require('cli-color')
const logUpdate = require('log-update')

module.exports = {
  appendToFile: (outputTo, sprites) => {
    const outFile = yaml.safeDump(sprites)

    fs.appendFile(outputTo, outFile, err => {
      if (err) return console.log(warningMsg(err))
    })
  },

  showLoading: () => {
    const frames = ['-', '\\', '|', '/']
    let i = 0

    return setInterval(() => {
      const frame = frames[(i = ++i % frames.length)]
      logUpdate(`${frame} Converting video to frames ${frame}`)
    }, 80)
  },

  readFile: (pathTo) => {
    return new Promise((resolve, reject) => {
      fs.readFile(pathTo, (err, data) => {
        if (!err) return resolve(data)
        console.log(err)
        reject(err)
      })
    })
  },

  infoMsg: (msg) => {
    const infoColor = clc.xterm(33)
    return infoColor(msg)
  },

  errMsg: (msg) => {
    const errColor = clc.xterm(9)
    return errColor(msg)
  },

  warningMsg: (msg) => {
    const warningColor = clc.xterm(214)
    return warningColor(msg)
  }
}
