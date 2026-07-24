const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const youtubeHomepageApiSchema = new Schema({
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    Views: {
        type: Number,
        required: true
    },
    Time: {
        type: Number,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    channelName: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        required: true
    },
    timer: {
        type: String,
        required: false
    },
    createdBy: {
        type: String,
        required: false
    }
});

const modelName = 'YoutubeHomepageApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, youtubeHomepageApiSchema);
