const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const shortsContentSchema = new Schema({
    shortId:        { type: String, required: true, unique: true },
    channelId:      { type: String, required: true },
    videoUrl:       { type: String, required: true },
    Likes:          { type: Number, required: false, default: 0 },
    Dislikes:       { type: Number, required: false, default: 0 },
    channelName:    { type: String, required: false },
    ProfilePicture: { type: String, required: false },
    createdBy:      { type: String, required: false }
});

const modelName = 'ShortsContentApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, shortsContentSchema);
