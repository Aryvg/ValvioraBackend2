const express= require('express');
const router= express.Router();
const VideoContentApisController = require('../../controllers/videocontentapiController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT= require('../../middleware/verifyJWT');
const { VideoContentApiSanitization, handleValidationErrors } = require('../../controllers/videocontentapiController');
router.use(rateLimit);
router.route('/')
     .get(VideoContentApisController.getAllVideoContentApis)
     .post(
        upload.fields([{ name: 'video', maxCount: 1 }]),
        VideoContentApiSanitization,
        handleValidationErrors,
       VideoContentApisController.createNewVideoContentApi
     )
     .put(
        upload.fields([{ name: 'video', maxCount: 1 }]),
        VideoContentApiSanitization,
        handleValidationErrors,
       VideoContentApisController.updateVideoContentApi
     )
     .delete(verifyJWT, VideoContentApisController.deleteVideoContentApi);
router.route('/:videoId')
     .get(VideoContentApisController.getVideoContentApi)
     .put(
        upload.fields([{ name: 'video', maxCount: 1 }]),
        VideoContentApiSanitization,
        handleValidationErrors,
       VideoContentApisController.updateVideoContentApi
     );
module.exports=router;