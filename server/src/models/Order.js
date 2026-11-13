const { Schema, model } = require('mongoose');

const STATUSES = ['received', 'preparing', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'];
const ACTIVE_STATUSES = ['received', 'preparing', 'out_for_delivery'];

// Name/price are snapshotted so later menu edits don't change past orders.
const lineSchema = new Schema({
  menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: String,
  isVeg: Boolean,
  unitPrice: Number,
  qty: Number,
  addOns: [{ name: String, price: Number }],
  lineTotal: Number,
  note: String,
}, { _id: false });

const orderSchema = new Schema({
  restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  roomNumber: String,
  orderNumber: { type: Number, index: true }, // short human-friendly number
  items: [lineSchema],
  subtotal: Number,
  tax: Number,
  total: Number,
  guestName: String,
  guestPhone: String,
  paymentMethod: { type: String, enum: ['room_charge'], default: 'room_charge' },
  prepMins: { type: Number, default: 30 }, // estimated preparation + delivery time
  rejectReason: String, // shown to the guest when rejected/cancelled
  notes: String,
  status: { type: String, enum: STATUSES, default: 'received', index: true },
  statusHistory: [{ status: String, at: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });

const Order = model('Order', orderSchema);
Order.STATUSES = STATUSES;
Order.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports = Order;
