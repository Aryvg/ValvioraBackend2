// backend/config/multerCloudinary.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');
const path = require('path');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'uploads';
    const isVideo = file.mimetype.startsWith('video/');
    if (file.mimetype.startsWith('image/')) folder = 'images';
    if (isVideo) folder = 'videos';
    // sanitize public_id: strip extension, lowercase, replace disallowed chars, cap length, append timestamp
    const parsed = path.parse(file.originalname || 'file');
    let base = (parsed.name || 'file').toString();
    base = base.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (base.length > 80) base = base.slice(0, 80);
    const publicId = `${base}-${Date.now()}`;
    return {
      folder,
      public_id: publicId,
      resource_type: 'auto',
      allowed_formats: isVideo
        ? ['mp4', 'webm', 'mov', 'avi', 'mkv']
        : ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'gif'],
    };
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (/^(image|video)\//.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed.'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 10MB
});

module.exports = upload;



