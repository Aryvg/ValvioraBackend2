const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const aggregatedapiSchema = new Schema({
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
    video: {
        type: String,
        required: false
    },
    image: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    DetailedDescription: {
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
    createdBy: {
        type: String,
        required: false
    },
    timer: {
        type: String,
        required: false
    }
    ,
    playlistId: {
        type: String,
        required: false
    },
    isBanned: { type: Boolean, required: false, default: false }
});

const modelName = 'AggregatedVideoApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, aggregatedapiSchema);