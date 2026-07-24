const express= require('express');
const router= express.Router();
const videosummaryApisController= require('../../controllers/videosummaryapiController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT= require('../../middleware/verifyJWT');
const { videosummaryapiSanitization: AggregatedVideoApiSanitization, handleValidationErrors } = require('../../controllers/videosummaryapiController');
router.use(rateLimit);
router.route('/')
     .get(videosummaryApisController.getAllvideosummaryapis)
     .post(
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        videosummaryApisController.createNewvideosummaryapi
     )
     .put(
        verifyJWT,
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        videosummaryApisController.updatevideosummaryapi
     )
   .delete(verifyJWT, videosummaryApisController.deletevideosummaryapi);
router.route('/:videoId')
     .get(videosummaryApisController.getvideosummaryapi)
     .put(
        verifyJWT,
        AggregatedVideoApiSanitization,
        handleValidationErrors,
        videosummaryApisController.updatevideosummaryapi
     );
module.exports=router;