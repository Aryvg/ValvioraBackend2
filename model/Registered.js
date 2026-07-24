const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    UserId:{
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    roles: {
        User: {
            type: Number,
            default: 2001 // means everyone will have this as a default
        },
        Editor: Number,
        Admin: Number
    },
    password: {
        type: String,
        required: true
    },
    firstname: {
        type: String,
        required: true
    },
     age: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
     country: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        required: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastActiveAt: {
        type: Number,
        default: null
    },
    refreshToken: String
    ,
    resetVerificationCode: String,
    resetVerificationExpires: Date
});

const modelName = 'Registered';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, userSchema);
//Th model folder we use