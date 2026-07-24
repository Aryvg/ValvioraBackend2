const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const rateLimit = require('../middleware/rateLimit');
const upload = require('../config/multerCloudinary');
router.use(rateLimit);
router.post('/', upload.single('profilePicture'), registerController.handleNewUser);
router.post('/verify', registerController.verifyCode);
module.exports = router;

