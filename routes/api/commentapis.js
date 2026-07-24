const express = require('express');
const router = express.Router();
const commentApiController = require('../../controllers/commentApiController');
const rateLimit = require('../../middleware/rateLimit');
const verifyJWT = require('../../middleware/verifyJWT');

router.use(rateLimit);

// GET all comments for a content (public) | POST a new comment (auth required)
router.route('/')
    .get(commentApiController.getAllComments)
    .post(verifyJWT, commentApiController.createComment);

router.get('/me/profile', verifyJWT, commentApiController.getMyProfile);

// Like and dislike (auth required) — must be defined BEFORE /:commentId
// to prevent Express from treating 'like'/'dislike' as a commentId value
router.put('/:commentId/like',    verifyJWT, commentApiController.likeComment);
router.put('/:commentId/dislike', verifyJWT, commentApiController.dislikeComment);

// Single comment: GET (public), PUT (auth), DELETE (auth)
router.route('/:commentId')
    .get(commentApiController.getComment)
    .put(verifyJWT, commentApiController.updateComment)
    .delete(verifyJWT, commentApiController.deleteComment);

module.exports = router;
