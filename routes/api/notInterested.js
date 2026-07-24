const express = require('express');
const router = express.Router();
const notInterestedController = require('../../controllers/notInterestedController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);
router.use(verifyJWT);

router.route('/')
    .get(notInterestedController.getNotInterested)
    .post(notInterestedController.markNotInterested)
    .delete(notInterestedController.removeNotInterested);

module.exports = router;
