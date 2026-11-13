const { Schema, model } = require('mongoose');

module.exports = model('Category', new Schema({
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: String, // short italic subtitle shown under the section title
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true }));
