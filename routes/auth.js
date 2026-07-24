const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('../middleware/rateLimit');
router.use(rateLimit);
router.post('/', authController.handleLogin);
module.exports = router;
