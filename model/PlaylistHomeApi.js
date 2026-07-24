const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playlistHomeSchema = new Schema({
    playlistId:    { type: String, required: true, unique: true },
    thumbnail:     { type: String, required: false, default: '' },
    channelId:     { type: String, required: true },
    playlistTitle: { type: String, required: true },
    views:         { type: Number, required: true, default: 0 },
    viewedBy:      { type: [String], default: [] },
    time:          { type: Number, required: true },
    channelName:   { type: String, required: false },
    ProfilePicture:{ type: String, required: false },
    createdBy:     { type: String, required: false },
    isBanned: { type: Boolean, required: false, default: false }
});

const modelName = 'PlaylistHomeApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, playlistHomeSchema);
