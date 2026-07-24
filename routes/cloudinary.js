const express = require('express');
const router = express.Router();
const { getCloudinarySignature } = require('../controllers/cloudinarySignatureController');

router.post('/cloudinary-signature', getCloudinarySignature);

module.exports = router;
