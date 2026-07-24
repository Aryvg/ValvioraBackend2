const express = require('express');
const router = express.Router();
const notificationApiController = require('../../controllers/notificationApiController');
const verifyJWT = require('../../middleware/verifyJWT');
const rateLimit = require('../../middleware/rateLimit');
const { NotificationApiSanitization, handleValidationErrors } = require('../../middleware/sanitization');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, notificationApiController.getNotifications)
    .post(verifyJWT, NotificationApiSanitization, handleValidationErrors, notificationApiController.updateNotificationReadStatus);

module.exports = router;
