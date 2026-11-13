const { Schema, model } = require('mongoose');

// The QR code encodes only `token` - never the room number.
module.exports = model('Room', new Schema({
  hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true },
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  number: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
}, { timestamps: true }));
