const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const videosummarySchema = new Schema({
    channelId: {
        type: String,
        required: true
    },
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,// means it must be text
        required: true// required:true means it must exist and it must not be empty
    },
    Views: {
        type: Number,
        required: true
    },
    Time: {
        type: Number,
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
    ,
    playlistId: {
        type: String,
        required: false
    },
    Likes: {
        type: Number,
        default: 0
    },
    Dislikes: {
        type: Number,
        default: 0
    },
    viewedBy: {
        type: [String],
        default: []
    }
    // subscribe removed — handled externally if needed
});

const modelName = 'videosummaryapi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, videosummarySchema);