const express = require('express');
const router = express.Router();
const refreshTokenController = require('../controllers/refreshTokenController');
const rateLimit = require('../middleware/rateLimit');
router.use(rateLimit);
router.get('/', refreshTokenController.handleRefreshToken)
module.exports = router;
//it will be run here