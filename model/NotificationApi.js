const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationApiSchema = new Schema({
    user: {
        type: String,
        required: true,
        index: true
    },
    videoId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ''
    },
    profilePicture: {
        type: String,
        default: ''
    },
    timer: {
        type: String,
        default: '0:00'
    },
    isRead: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// One notification per (user, videoId) — makes the fan-out insert idempotent/safe to retry.
notificationApiSchema.index({ user: 1, videoId: 1 }, { unique: true });

const modelName = 'NotificationApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, notificationApiSchema);
