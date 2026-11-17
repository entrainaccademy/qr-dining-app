const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { publicOrder, adminOrder } = require('../lib/serialize');
const { kitchenState, pretty } = require('../lib/hours');
const { reserveStock, restoreStock } = require('../lib/stock');

const router = express.Router();
const MAX_ACTIVE_ORDERS = 3;
const round2 = (n) => Math.round(n * 100) / 100;
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});
const menuLimiter = rateLimit({ windowMs: 60 * 1000, limit: 240, message: { error: 'Too many requests.' } });

// Finds an active room from its QR token (token only; never a room number).
async function roomFromToken(token) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 100) return null;
  return Room.findOne({ token, active: true });
}

// GET /api/menu?t=token
router.get('/menu', menuLimiter, async (req, res) => {
  const room = await roomFromToken(req.query.t);
  if (!room) return res.status(404).json({ error: 'Invalid or expired QR code' });

  const [hotel, restaurant, categories, items] = await Promise.all([
    Hotel.findById(room.hotel).lean(),
    Restaurant.findById(room.restaurant).lean(),
    Category.find({ restaurant: room.restaurant }).sort('sortOrder').lean(),
    MenuItem.find({ restaurant: room.restaurant }).sort('sortOrder').lean(),
  ]);

  const kitchen = kitchenState(restaurant);
  res.json({
    hotel: { name: hotel.name },
    restaurant: {
      id: restaurant._id, name: restaurant.name, tagline: restaurant.tagline, gstPercent: restaurant.gstPercent,
      isOpen: kitchen.open, closedReason: kitchen.reason, closedMessage: kitchen.message, // why ordering is off, in guest-friendly words
      hoursText: restaurant.hours && restaurant.hours.enabled ? `${pretty(restaurant.hours.open)} – ${pretty(restaurant.hours.close)}` : null,
    },
    room: { number: room.number },
    categories: categories
      .map((c) => ({
        id: c._id,
        name: c.name,
        description: c.description,
        items: items
          .filter((i) => String(i.category) === String(c._id))
          .map((i) => ({
            id: i._id, name: i.name, description: i.description, price: i.price,
            // Guests only learn sold-out or not; the exact stock count stays on the admin side.
            isVeg: i.isVeg, image: i.image, available: i.available !== false && !(typeof i.stock === 'number' && i.stock <= 0),
            addOns: i.addOns.map((a) => ({ id: a._id, name: a.name, price: a.price })),
          })),
      }))
      .filter((c) => c.items.length),
  });
});

const orderSchema = z.object({
  token: z.string().min(10).max(100),
  guestName: z.string().trim().max(60).optional(),
  guestPhone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone number').optional().or(z.literal('')),
  paymentMethod: z.enum(['room_charge']).default('room_charge'),
  notes: z.string().trim().max(300).optional(),
  items: z.array(z.object({
    menuItemId: objectId,
    qty: z.number().int().min(1).max(20),
    addOnIds: z.array(objectId).max(10).optional(),
    note: z.string().trim().max(140).optional(),
  })).min(1).max(30),
});

// POST /api/orders - the client sends ids and quantities only; prices come from the DB.
router.post('/orders', orderLimiter, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid order', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  }
  const { token, items, guestName, guestPhone, paymentMethod, notes } = parsed.data;

  const room = await roomFromToken(token);
  if (!room) return res.status(404).json({ error: 'Invalid or expired QR code' });

  const restaurant = await Restaurant.findById(room.restaurant);
  const kitchen = kitchenState(restaurant);
  if (!kitchen.open) return res.status(409).json({ error: kitchen.message });

  const active = await Order.countDocuments({ room: room._id, status: { $in: Order.ACTIVE_STATUSES } });
  if (active >= MAX_ACTIVE_ORDERS) {
    return res.status(429).json({ error: `You already have ${MAX_ACTIVE_ORDERS} active orders. Please wait for one to be delivered.` });
  }

  // Load every referenced menu item in one query and build trusted lines.
  const ids = [...new Set(items.map((i) => i.menuItemId))];
  const menuItems = await MenuItem.find({ _id: { $in: ids }, restaurant: room.restaurant, available: true });
  const byId = new Map(menuItems.map((m) => [String(m._id), m]));

  const lines = [];
  for (const it of items) {
    const m = byId.get(it.menuItemId);
    if (!m) return res.status(400).json({ error: 'One or more items are unavailable. Please refresh the menu.' });
    const addOns = [];
    for (const aid of new Set(it.addOnIds || [])) {
      const a = m.addOns.id(aid);
      if (!a) return res.status(400).json({ error: `Invalid add-on for ${m.name}` });
      addOns.push({ name: a.name, price: a.price });
    }
    const unit = m.price + addOns.reduce((s, a) => s + a.price, 0);
    lines.push({ menuItem: m._id, name: m.name, isVeg: m.isVeg, unitPrice: m.price, qty: it.qty, addOns, note: it.note || undefined, lineTotal: round2(unit * it.qty) });
  }

  // Reserve stock. Each decrement is atomic and only succeeds if enough is left, so two guests
  // ordering the last portion can't both get it. Items with no stock count are unlimited.
  const reserved = await reserveStock(lines, byId);
  if (!reserved.ok) return res.status(409).json({ error: `Sorry, ${reserved.name} just sold out. Please update your cart.` });

  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const tax = round2((subtotal * restaurant.gstPercent) / 100);
  const last = await Order.findOne({ restaurant: restaurant._id }).sort('-orderNumber').select('orderNumber').lean();

  let order;
  try {
    order = await Order.create({
      restaurant: restaurant._id, room: room._id, roomNumber: room.number,
      orderNumber: ((last && last.orderNumber) || 1000) + 1,
      items: lines, subtotal, tax, total: round2(subtotal + tax),
      guestName, guestPhone: guestPhone || undefined, paymentMethod, notes, status: 'received', statusHistory: [{ status: 'received' }],
    });
  } catch (e) {
    await restoreStock(lines); // the order failed, so hand the portions back
    throw e;
  }

  req.app.get('io').to(`restaurant:${restaurant._id}`).emit('order:new', adminOrder(order));
  res.status(201).json({ order: publicOrder(order) });
});

// GET /api/orders/:id - public; the unguessable ObjectId acts as the tracking link.
router.get('/orders/:id', menuLimiter, async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Order not found' });
  const order = await Order.findById(req.params.id).lean();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order: publicOrder(order) });
});

module.exports = router;
