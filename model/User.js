const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true
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
    confirm : {
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
    refreshToken: String
    ,
    verificationCode: {
        type: String
    },
    verificationExpires: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    }
});

const modelName = 'User';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, userSchema);
//Th model folder we use