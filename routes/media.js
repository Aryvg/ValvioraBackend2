const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

router.get('/', mediaController.listMedia);
router.get('/file/:name', mediaController.getFile);
// Upload endpoint (POST /media/upload)
router.post('/upload', mediaController.upload.single('file'), mediaController.uploadMedia);

module.exports = router;
