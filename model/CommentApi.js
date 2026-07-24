const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
    commentId: {
        type: String,
        required: true,
        unique: true
    },
    contentId: {
        type: String,
        required: true,
        index: true
    },
    contentType: {
        type: String,
        required: true,
        enum: ['video', 'short']
    },
    userId: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 10000,
        trim: true
    },
    likes: {
        type: Number,
        default: 0,
        min: 0
    },
    dislikes: {
        type: Number,
        default: 0,
        min: 0
    },
    likedBy: {
        type: [String],
        default: []
    },
    dislikedBy: {
        type: [String],
        default: []
    },
    time: {
        type: Date,
        default: Date.now
    },
    parentCommentId: {
        type: String,
        default: null
    }
});

const modelName = 'CommentApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, commentSchema);
