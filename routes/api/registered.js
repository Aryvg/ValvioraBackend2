const express= require('express');
const router= express.Router();
const registeredController= require('../../controllers/registeredController');
const upload = require('../../config/multerCloudinary');//sends files to cloudinary
const ROLES_LIST= require('../../config/roles-list');
const verifyRoles= require('../../middleware/verifyRoles');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT= require('../../middleware/verifyJWT');
const { employeeSanitization, handleValidationErrors } = require('../../controllers/registeredController');
router.use(rateLimit);
// Check existing finalized registrations
router.get('/exists', registeredController.existsRegistered);
// Presence: heartbeat while on an allowed page, and an offline signal on page leave.
router.post('/presence/heartbeat', verifyJWT, registeredController.presenceHeartbeat);
router.post('/presence/offline', verifyJWT, registeredController.presenceOffline);
// ADDED - self-service "my account" endpoints. Both are scoped to the
// logged-in user via verifyJWT; neither requires the Admin role, unlike the
// bulk GET / and DELETE / routes below, which remain admin-only and untouched.
router.get('/me', verifyJWT, registeredController.getMyRegistered);
router.delete('/me', verifyJWT, registeredController.deleteMyRegistered);
router.route('/')
     .get(verifyJWT, verifyRoles(ROLES_LIST.Admin), registeredController.getAllRegistereds)
     .post(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        registeredController.createNewRegistered
     )
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        registeredController.updateRegistered
     )
     .delete(verifyJWT, verifyRoles(ROLES_LIST.Admin), registeredController.deleteRegistered);
router.route('/:userId')
     .get(registeredController.getRegistered)
     .put(
        upload.fields([{ name: 'image', maxCount: 1 }]),
        employeeSanitization,
        handleValidationErrors,
        registeredController.updateRegistered
     );
router.patch('/:userId/role', verifyJWT, verifyRoles(ROLES_LIST.Admin), registeredController.setAdminRole);
// Password reset: request and verify
router.post('/reset-request', registeredController.requestPasswordReset);
router.post('/reset-verify', registeredController.verifyResetCode);
module.exports=router;