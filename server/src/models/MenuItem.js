const { Schema, model } = require('mongoose');

const addOnSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }, // INR
});

module.exports = model('MenuItem', new Schema({
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  name: { type: String, required: true, trim: true },
  description: String,
  price: { type: Number, required: true, min: 0 }, // INR, before GST
  isVeg: { type: Boolean, default: true },
  image: String,
  addOns: [addOnSchema],
  available: { type: Boolean, default: true }, // manual sold-out switch
  // Portions left today. null/missing = not tracked (unlimited). Admin-only; guests just see sold out or not.
  stock: { type: Number, min: 0, default: null },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true }));
