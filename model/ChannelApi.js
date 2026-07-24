const mongoose = require('mongoose');// mongoose is a tool to talk to the databse
const Schema = mongoose.Schema;// schema is blue print maker or plan maker

const channelSchema = new Schema({
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    channelname: {
        type: String,// means it must be text
        required: true// required:true means it must exist and it must not be empty
    },
    channelType: {
        type: String,
        required: true
    },
    Description: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        required: true
    },
    channelBanner: {
        type: String, //say type:Number if it is number
        required: false// means sending video is optional
    },
    contactEmail: {
        type: String, //say type:Number if it is number
        required: false// means sending video is optional
    },
    subscribe: {
        type: Number,
        default: 0
    },
    subscribers: {
        type: [
            {
                username: { type: String, required: true },
                subscribedAt: { type: Date, required: true, default: Date.now }
            }
        ],
        default: []
    },
    createdBy: {
        type: String,
        required: false,
        unique: true,
        index: true
    },
});

const modelName = 'ChannelApi';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, channelSchema);