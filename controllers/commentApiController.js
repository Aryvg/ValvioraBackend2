const Comment = require('../model/CommentApi');
const Registered = require('../model/Registered');
const formatCount = require('../utils/formatCount');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

const serializeCommentTime = (value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
};

const getCurrentUsernameFromRequest = (req) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== 'string') return null;
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : authHeader;
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const info = decoded.UserInfo || decoded.userInfo || null;
        return info?.username || null;
    } catch (e) {
        return null;
    }
};

const formatComment = (comment, userMap, currentUsername) => {
    const user = userMap.get(comment.userId) || null;
    const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
    const dislikedBy = Array.isArray(comment.dislikedBy) ? comment.dislikedBy : [];
    return {
        commentId:       comment.commentId,
        contentId:       comment.contentId,
        contentType:     comment.contentType,
        userId:          comment.userId,
        userInfo: {
            ProfilePicture: user?.profilePicture || '',
            email:          user ? `@${user.username}` : '@unknown'
        },
        text:            comment.text,
        likes:           formatCount(comment.likes),
        dislikes:        formatCount(comment.dislikes),
        time:            serializeCommentTime(comment.time),
        parentCommentId: comment.parentCommentId || null,
        userReaction: currentUsername
            ? (likedBy.includes(currentUsername) ? 'like' : (dislikedBy.includes(currentUsername) ? 'dislike' : null))
            : null
    };
};

const getAllComments = async (req, res) => {
    const { contentId } = req.query;
    const currentUsername = getCurrentUsernameFromRequest(req);
    try {
        let topLevel;
        
        // If contentId is provided, fetch comments for that content
        // Otherwise, fetch all top-level comments across all content
        if (contentId) {
            const allComments = await Comment.find({ contentId }).lean();
            if (!allComments || allComments.length === 0) return res.json([]);
            topLevel = allComments.filter(c => !c.parentCommentId);
        } else {
            // Fetch all top-level comments (no contentId filter)
            topLevel = await Comment.find({ parentCommentId: null }).lean();
            if (!topLevel || topLevel.length === 0) return res.json([]);
        }

        // Get userIds from top-level comments
        const userIds = [...new Set(topLevel.map(c => c.userId))];
        const users = await Registered.find({ UserId: { $in: userIds } }).lean();
        const userMap = new Map(users.map(u => [u.UserId, u]));

        // Fetch all replies for these top-level comments
        const topLevelIds = topLevel.map(c => c.commentId);
        const replies = await Comment.find({ parentCommentId: { $in: topLevelIds } }).lean();
        
        // Get users for replies
        if (replies && replies.length > 0) {
            const replyUserIds = [...new Set(replies.map(r => r.userId))];
            const replyUsers = await Registered.find({ UserId: { $in: replyUserIds } }).lean();
            replyUsers.forEach(u => userMap.set(u.UserId, u)); // Merge into userMap
        }

        // Build reply map
        const replyMap = {};
        replies.forEach(r => {
            if (!replyMap[r.parentCommentId]) replyMap[r.parentCommentId] = [];
            replyMap[r.parentCommentId].push(formatComment(r, userMap, currentUsername));
        });

        // Build result with nested replies
        const result = topLevel.map(c => ({
            ...formatComment(c, userMap, currentUsername),
            replies: replyMap[c.commentId] || []
        }));

        res.json(result);
    } catch (err) {
        console.error('getAllComments error:', err);
        res.status(500).json({ message: 'Failed to fetch comments.' });
    }
};

const getComment = async (req, res) => {
    const { commentId } = req.params;
    const currentUsername = getCurrentUsernameFromRequest(req);
    if (!commentId) return res.status(400).json({ message: 'commentId is required.' });
    try {
        const comment = await Comment.findOne({ commentId }).lean();
        if (!comment) return res.status(404).json({ message: 'Comment not found.' });

        const replies = await Comment.find({ parentCommentId: commentId }).lean();

        const userIds = [...new Set([comment.userId, ...replies.map(r => r.userId)])];
        const users   = await Registered.find({ UserId: { $in: userIds } }).lean();
        const userMap = new Map(users.map(u => [u.UserId, u]));

        res.json({
            ...formatComment(comment, userMap, currentUsername),
            replies: replies.map(r => formatComment(r, userMap, currentUsername))
        });
    } catch (err) {
        console.error('getComment error:', err);
        res.status(500).json({ message: 'Failed to fetch comment.' });
    }
};

const getMyProfile = async (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'You must be logged in.' });
    try {
        const registeredUser = await Registered.findOne({ username: req.user }).lean();
        if (!registeredUser) return res.status(404).json({ message: 'User not found.' });
        res.json({
            UserId: registeredUser.UserId,
            username: registeredUser.username,
            profilePicture: registeredUser.profilePicture || ''
        });
    } catch (err) {
        console.error('getMyProfile error:', err);
        res.status(500).json({ message: 'Failed to fetch profile.' });
    }
};

const createComment = async (req, res) => {
    const { contentId, contentType, text, parentCommentId } = req.body;

    if (!contentId || !contentType || !text) {
        return res.status(400).json({ message: 'contentId, contentType, and text are required.' });
    }
    if (!['video', 'short'].includes(contentType)) {
        return res.status(400).json({ message: 'contentType must be "video" or "short".' });
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'text must be a non-empty string.' });
    }
    if (text.trim().length > 10000) {
        return res.status(400).json({ message: 'text must not exceed 10,000 characters.' });
    }

    try {
        if (parentCommentId) {
            const parent = await Comment.findOne({ commentId: parentCommentId }).lean();
            if (!parent) return res.status(404).json({ message: 'Parent comment not found.' });
            if (parent.parentCommentId) {
                return res.status(400).json({ message: 'Cannot reply to a reply. Only one level of nesting is allowed.' });
            }
        }

        const registeredUser = await Registered.findOne({ username: req.user }).lean();
        if (!registeredUser) return res.status(401).json({ message: 'Authenticated user not found in database.' });

        const newComment = await Comment.create({
            commentId:       crypto.randomUUID(),
            contentId:       contentId.trim(),
            contentType,
            userId:          registeredUser.UserId,
            text:            text.trim(),
            likes:           0,
            dislikes:        0,
            likedBy:         [],
            dislikedBy:      [],
            time:            new Date(),
            parentCommentId: parentCommentId || null
        });

        res.status(201).json({
            commentId:       newComment.commentId,
            contentId:       newComment.contentId,
            contentType:     newComment.contentType,
            userId:          newComment.userId,
            userInfo: {
                ProfilePicture: registeredUser.profilePicture || '',
                email:          `@${registeredUser.username}`
            },
            text:            newComment.text,
            likes:           formatCount(newComment.likes),
            dislikes:        formatCount(newComment.dislikes),
            time:            serializeCommentTime(newComment.time),
            parentCommentId: newComment.parentCommentId,
            replies:         []
        });
    } catch (err) {
        console.error('createComment error:', err);
        res.status(500).json({ message: 'Failed to create comment.' });
    }
};

const updateComment = async (req, res) => {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!commentId) return res.status(400).json({ message: 'commentId is required.' });
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: 'text must be a non-empty string.' });
    }
    if (text.trim().length > 10000) {
        return res.status(400).json({ message: 'text must not exceed 10,000 characters.' });
    }

    try {
        const comment = await Comment.findOne({ commentId }).exec();
        if (!comment) return res.status(404).json({ message: 'Comment not found.' });

        const registeredUser = await Registered.findOne({ username: req.user }).lean();
        if (!registeredUser || comment.userId !== registeredUser.UserId) {
            return res.status(403).json({ message: 'You can only edit your own comments.' });
        }

        comment.text = text.trim();
        const updated = await comment.save();
        res.json({ message: 'Comment updated.', commentId: updated.commentId, text: updated.text });
    } catch (err) {
        console.error('updateComment error:', err);
        res.status(500).json({ message: 'Failed to update comment.' });
    }
};

const deleteComment = async (req, res) => {
    const { commentId } = req.params;
    if (!commentId) return res.status(400).json({ message: 'commentId is required.' });

    try {
        const comment = await Comment.findOne({ commentId }).lean();
        if (!comment) return res.status(404).json({ message: 'Comment not found.' });

        const registeredUser = await Registered.findOne({ username: req.user }).lean();
        if (!registeredUser || comment.userId !== registeredUser.UserId) {
            return res.status(403).json({ message: 'You can only delete your own comments.' });
        }

        await Comment.deleteMany({ $or: [{ commentId }, { parentCommentId: commentId }] });
        res.json({ message: 'Comment and all its replies deleted successfully.' });
    } catch (err) {
        console.error('deleteComment error:', err);
        res.status(500).json({ message: 'Failed to delete comment.' });
    }
};

const updateCommentReaction = async (req, res, reaction) => {
    const { commentId } = req.params;
    if (!commentId) return res.status(400).json({ message: 'commentId is required.' });
    if (!req.user) return res.status(401).json({ message: 'You must be logged in.' });

    try {
        const comment = await Comment.findOne({ commentId }).exec();
        if (!comment) return res.status(404).json({ message: 'Comment not found.' });

        if (!Array.isArray(comment.likedBy)) comment.likedBy = [];
        if (!Array.isArray(comment.dislikedBy)) comment.dislikedBy = [];

        const hasLiked = comment.likedBy.includes(req.user);
        const hasDisliked = comment.dislikedBy.includes(req.user);

        if (reaction === 'like') {
            if (hasLiked) {
                comment.likedBy = comment.likedBy.filter(u => u !== req.user);
            } else {
                comment.likedBy.push(req.user);
                if (hasDisliked) comment.dislikedBy = comment.dislikedBy.filter(u => u !== req.user);
            }
        } else {
            if (hasDisliked) {
                comment.dislikedBy = comment.dislikedBy.filter(u => u !== req.user);
            } else {
                comment.dislikedBy.push(req.user);
                if (hasLiked) comment.likedBy = comment.likedBy.filter(u => u !== req.user);
            }
        }

        comment.likes = comment.likedBy.length;
        comment.dislikes = comment.dislikedBy.length;

        const updated = await comment.save();
        res.json({
            message: reaction === 'like' ? 'Like updated.' : 'Dislike updated.',
            likes: updated.likes,
            dislikes: updated.dislikes,
            userReaction: updated.likedBy.includes(req.user)
                ? 'like'
                : (updated.dislikedBy.includes(req.user) ? 'dislike' : null)
        });
    } catch (err) {
        console.error(`updateCommentReaction (${reaction}) error:`, err);
        res.status(500).json({ message: 'Failed to update comment reaction.' });
    }
};

const likeComment = async (req, res) => {
    await updateCommentReaction(req, res, 'like');
};

const dislikeComment = async (req, res) => {
    await updateCommentReaction(req, res, 'dislike');
};

module.exports = {
    getAllComments,
    getComment,
    getMyProfile,
    createComment,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment
};
