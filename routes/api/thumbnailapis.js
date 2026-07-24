const express= require('express');
const router= express.Router();
const ThumbnailApiController= require('../../controllers/thumbnailapiController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT= require('../../middleware/verifyJWT');
const { ThumbnailApiSanitization, handleValidationErrors } = require('../../controllers/thumbnailapiController');
router.use(rateLimit);
router.route('/')
     .get(ThumbnailApiController.getAllThumbnailApis)
     .post(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        ThumbnailApiSanitization,
        handleValidationErrors,
        ThumbnailApiController.createNewThumbnailApi
     )
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        ThumbnailApiSanitization,
        handleValidationErrors,
        ThumbnailApiController.updateThumbnailApi
     )
   .delete(verifyJWT, ThumbnailApiController.deleteThumbnailApi);
router.route('/:videoId')
     .get(ThumbnailApiController.getThumbnailApi)
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        ThumbnailApiSanitization,
        handleValidationErrors,
        ThumbnailApiController.updateThumbnailApi
     );
module.exports=router;