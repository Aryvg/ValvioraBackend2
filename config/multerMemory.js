const multer = require('multer');

// store files in memory and let the controller upload to Cloudinary after validation
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
