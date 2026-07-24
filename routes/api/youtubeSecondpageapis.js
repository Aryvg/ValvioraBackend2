const express = require('express');
const router = express.Router();
const YoutubeSecondpageapisController = require('../../controllers/youtubeSecondpageapiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, YoutubeSecondpageapisController.getAllYoutubeSecondpageapis);

router.route('/:videoId')
    .get(YoutubeSecondpageapisController.getYoutubeSecondpageapi);

module.exports = router;
