const express = require('express');
const router = express.Router();
const controller = require('../../controllers/aggregatedShortsApiController');
const upload = require('../../config/multerCloudinary');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, controller.getAllAggregatedShortsApis)
    .post(verifyJWT, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), controller.createNewAggregatedShortsApi)
    .put(upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), controller.updateAggregatedShortsApi)
    .delete(controller.deleteAggregatedShortsApi);

router.put('/:shortId/like', verifyJWT, controller.likeAggregatedShort);
router.put('/:shortId/dislike', verifyJWT, controller.dislikeAggregatedShort);

router.route('/:shortId')
    .get(controller.getAggregatedShortsApi)
    .put(upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), controller.updateAggregatedShortsApi);

module.exports = router;
