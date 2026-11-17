const { Schema, model } = require('mongoose');

module.exports = model('Restaurant', new Schema({
  hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name: { type: String, required: true, trim: true },
  tagline: String,
  gstPercent: { type: Number, default: 5 },
  isOpen: { type: Boolean, default: true }, // restaurant open at all (owner/manager)
  ordersPaused: { type: Boolean, default: false }, // quick "pause ordering" switch for the kitchen
  // Optional daily opening hours (24h "HH:MM", India time). When enabled, orders outside them are blocked.
  hours: {
    enabled: { type: Boolean, default: false },
    open: { type: String, default: '07:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    close: { type: String, default: '23:30', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
}, { timestamps: true }));
