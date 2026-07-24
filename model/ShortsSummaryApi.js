const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const shortsSummarySchema = new Schema({
    shortId:   { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    thumbnail: { type: String, required: true },
    title:     { type: String, required: true },
    views:     { type: Number, required: false, default: 0 },
    viewedBy:  { type: [String], default: [] },
    createdBy: { type: String, required: false },
    isBanned:  { type: Boolean, required: false, default: false }
});

const modelName = 'ShortsSummaryApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, shortsSummarySchema);
