const { Schema, model } = require('mongoose');

module.exports = model('Hotel', new Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
}, { timestamps: true }));
