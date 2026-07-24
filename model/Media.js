const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mediaSchema = new Schema({
  filename: { type: String, required: true, unique: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true }
});

const modelName = 'Media';
module.exports = mongoose.models[modelName] || mongoose.model(modelName, mediaSchema);
