const express = require('express');
const router = express.Router();
const YoutubeHomepageApiController = require('../../controllers/youtubeHomepageApiController');
const verifyJWT = require('../../middleware/verifyJWT');
const rateLimit = require('../../middleware/rateLimit');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, YoutubeHomepageApiController.getAllYoutubeHomepageApis)
    .post(verifyJWT, YoutubeHomepageApiController.createNewYoutubeHomepageApi)
    .put(verifyJWT, YoutubeHomepageApiController.updateYoutubeHomepageApi)
    .delete(verifyJWT, YoutubeHomepageApiController.deleteYoutubeHomepageApi);

router.route('/:videoId')
    .get(YoutubeHomepageApiController.getYoutubeHomepageApi)
    .put(verifyJWT, YoutubeHomepageApiController.updateYoutubeHomepageApi);

module.exports = router;
