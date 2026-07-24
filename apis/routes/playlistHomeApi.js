const express = require('express');
const router = express.Router();
const controller = require('../../controllers/playlistHomeApiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, controller.getAllPlaylistHomeApis)
    .post(verifyJWT, controller.createNewPlaylistHomeApi)
    .put(verifyJWT, controller.updatePlaylistHomeApi)
    .delete(verifyJWT, controller.deletePlaylistHomeApi);

router.route('/:playlistId')
    .get(controller.getPlaylistHomeApi)
    .put(verifyJWT, controller.updatePlaylistHomeApi);

module.exports = router;
