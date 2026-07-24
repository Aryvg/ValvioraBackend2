const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const videocontentapiSchema = new Schema({
    channelId: {
        type: String,
        required: true
    },
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    video: {
        type: String,
        required: false
    },
    shortDescription: {
        type: String,
        required: true
    },
    DetailedDescription: {
        type: String,
        required: true
    },
    createdBy: {
        type: String,
        required: false
    }
    ,
    playlistId: {
        type: String,
        required: false
    }
});

const modelName = 'VideoContentApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, videocontentapiSchema);