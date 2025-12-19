// const multer = require('multer');
// const randomstring = require('randomstring');
// const multerS3 = require('multer-s3');
// const { S3Client } = require('@aws-sdk/client-s3');

// const s3 = new S3Client({
//   credentials: {
//     accessKeyId: global.constant.AWAWS_ACCESS_KEY_ID_NEW,
//     secretAccessKey: global.constant.AWS_SECRET_ACCESS_KEY_NEW
//   },
//   region: global.constant.REGION
// });

// // Configure multer-s3 for file uploads
// const upload = multer({
//   storage: multerS3({
//     s3: s3,
//     bucket: global.constant.BUCKET_NAME,
//     metadata: function (req, file, cb) {
//       // console.log('req.body---->>>>', req.body);
//       // console.log('req.file---->>>>', file);
//       cb(null, { fieldName: file.fieldname });
//     },
//     key: function (req, file, cb) {
//       // Define the file path in S3
//       let randomStr = randomstring.generate({
//         length: 8,
//         charset: 'alphabetic',
//         capitalization: 'uppercase'
//       });
//       const filePath = `${req.body.typename ? `${req.body.typename}/` : ''}${Date.now().toString()}-${randomStr}`;
//       cb(null, filePath);
//     },
//   }),
// });

// module.exports = upload;

const multer = require('multer');
const randomstring = require('randomstring');
const path = require('path');
const fs = require('fs');

// Destination folder for uploads
// const storagePath = path.join(__dirname, 'uploads');
const storagePath = path.join(__dirname, '../public/uploads');
// Ensure upload folder exists
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folderPath = storagePath;

    if (req.body.typename) {
      folderPath = path.join(storagePath, req.body.typename);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }

    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const randomStr = randomstring.generate({
      length: 8,
      charset: 'alphabetic',
      capitalization: 'uppercase',
    });

    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${randomStr}${ext}`;
    cb(null, fileName);
  },
});

// Init multer upload
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = upload;
