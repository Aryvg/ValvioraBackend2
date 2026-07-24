const express = require('express');
const router = express.Router();
const controller = require('../../controllers/shortsContentApiController');
const rateLimit = require('../../middleware/rateLimit');

router.use(rateLimit);

router.route('/')
    .get(controller.getAllShortsContentApis)
    .post(controller.createNewShortsContentApi)
    .put(controller.updateShortsContentApi)
    .delete(controller.deleteShortsContentApi);

router.route('/:shortId')
    .get(controller.getShortsContentApi);

module.exports = router;
