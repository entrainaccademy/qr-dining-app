const { Schema, model } = require('mongoose');

module.exports = model('Restaurant', new Schema({
  hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name: { type: String, required: true, trim: true },
  tagline: String,
  gstPercent: { type: Number, default: 5 },
  isOpen: { type: Boolean, default: true }, // restaurant open at all (owner/manager)
  ordersPaused: { type: Boolean, default: false }, // quick "pause ordering" switch for the kitchen
}, { timestamps: true }));
