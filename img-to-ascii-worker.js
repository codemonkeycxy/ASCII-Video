const {warningMsg} = require('./helpers')
const imageToAscii = require('image-to-ascii')
const {
  TMP_DIR_PATH,
  END_OF_FRAME_ID
} = require('./constants')

process.on('message', fileName => {
  const source = TMP_DIR_PATH + fileName
  const options = {image_type: 'jpg'}

  imageToAscii(source, options, (err, converted) => {
    if (err) {
      console.log(warningMsg(err))
    } else {
      process.send(converted + END_OF_FRAME_ID)
    }
  })
})
