const express = require('express');
const router = express.Router();
const controller = require('../../controllers/shortsSummaryApiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(controller.getAllShortsSummaryApis)
    .post(controller.createNewShortsSummaryApi)
    .put(verifyJWT, controller.updateShortsSummaryApi)
    .delete(controller.deleteShortsSummaryApi);

router.route('/:shortId')
    .get(controller.getShortsSummaryApi);

module.exports = router;
