const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const aggregatedShortsSchema = new Schema({
    shortId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    title: { type: String, required: true },
    views: { type: Number, required: false, default: 0 },
    thumbnail: { type: String, required: true },
    videoUrl: { type: String, required: true },
    createdAt: { type: String, required: false },
    Likes: { type: Number, required: false, default: 0 },
    Dislikes: { type: Number, required: false, default: 0 },
    likedBy: { type: [String], default: [] },
    dislikedBy: { type: [String], default: [] },
    channelName: { type: String, required: false },
    ProfilePicture: { type: String, required: false },
    createdBy: { type: String, required: false },
    isBanned: { type: Boolean, required: false, default: false }
});

const modelName = 'AggregatedShortsApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, aggregatedShortsSchema);
