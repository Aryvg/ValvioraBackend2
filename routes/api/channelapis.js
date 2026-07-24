const express= require('express');
const router= express.Router();
const channelApisController= require('../../controllers/channelApisController');
// use memory storage to avoid automatic Cloudinary uploads; controller will upload after validation
const upload = require('../../config/multerMemory');
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');
const { ChannelApiSanitization, handleValidationErrors } = require('../../middleware/sanitization');
router.use(rateLimit);
router.route('/')
     .get(channelApisController.getAllChannelDatas)
     .post(
        verifyJWT,
        upload.fields([{ name: 'profilePicture', maxCount: 1 }, { name: 'channelBanner', maxCount: 1 }]),
        ChannelApiSanitization,
        handleValidationErrors,
        channelApisController.createNewChannelData
     )
     .put(
        verifyJWT,
        upload.fields([{ name: 'profilePicture', maxCount: 1 }, { name: 'channelBanner', maxCount: 1 }]),
        ChannelApiSanitization,
        handleValidationErrors,
        channelApisController.updateChannelData
     )
     .delete(channelApisController.deleteChannelData);
// check if current logged-in user already has a channel
router.get('/exists', verifyJWT, channelApisController.checkUserChannel);
router.route('/:channelId')
     .get(channelApisController.getChannelData)
     .put(
        verifyJWT,
        upload.fields([{ name: 'profilePicture', maxCount: 1 }, { name: 'channelBanner', maxCount: 1 }]),
        ChannelApiSanitization,
        handleValidationErrors,
        channelApisController.updateChannelData
     );
module.exports=router;