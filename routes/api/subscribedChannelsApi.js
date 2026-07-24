const express = require('express');
const router = express.Router();
const subscribedChannelsApiController = require('../../controllers/subscribedChannelsApiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, subscribedChannelsApiController.getSubscribedChannels);

module.exports = router;
