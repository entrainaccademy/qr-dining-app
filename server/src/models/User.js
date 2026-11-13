const { Schema, model } = require('mongoose');

module.exports = model('User', new Schema({
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['owner', 'manager', 'kitchen'], required: true },
}, { timestamps: true }));
