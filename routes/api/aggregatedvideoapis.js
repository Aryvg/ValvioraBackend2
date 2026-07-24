const express= require('express');
const router= express.Router();
const AggregatedVideoApisController= require('../../controllers/aggregatedvideoapiController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT= require('../../middleware/verifyJWT');
const { AggregatedVideoApiSanitization, handleValidationErrors } = require('../../middleware/sanitization');
router.use(rateLimit);
router.route('/')
   .get(verifyJWT, AggregatedVideoApisController.getAllAggregatedVideoApis)
     .post(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        AggregatedVideoApisController.createNewAggregatedVideoApi
     )
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        AggregatedVideoApisController.updateAggregatedVideoApi
     )
     .delete(AggregatedVideoApisController.deleteAggregatedVideoApi);
router.get('/channel/:channelId', AggregatedVideoApisController.getVideosByChannel);
router.route('/:videoId')
     .get(AggregatedVideoApisController.getAggregatedVideoApi)
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]),
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        AggregatedVideoApisController.updateAggregatedVideoApi
     );
module.exports=router;