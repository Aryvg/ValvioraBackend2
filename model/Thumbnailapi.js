const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const thumbnailapiSchema = new Schema({
    channelId: {
        type: String,
        required: true
    },
    videoId: {
        type: String,
        required: true,
        unique: true
    },
    image: {
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

const modelName = 'ThumbnailApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, thumbnailapiSchema);