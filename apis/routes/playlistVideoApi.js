const express = require('express');
const router = express.Router();
const controller = require('../../controllers/playlistVideoApiController');
const PlaylistHomeApiController = require('../../controllers/playlistHomeApiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

router.route('/')
    .get(verifyJWT, (req, res) => {
        if (req.query.playlistId) {
            return controller.getPlaylistVideoApi(req, res);
        }
        return controller.getAllPlaylistVideoApis(req, res);
    })
    .put(PlaylistHomeApiController.updatePlaylistHomeApi)
    .delete(PlaylistHomeApiController.deletePlaylistHomeApi);

router.get('/channel/:channelId', controller.getPlaylistsByChannel);

router.route('/:playlistId')
    .get(controller.getPlaylistVideoApi);

module.exports = router;
