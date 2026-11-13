const express = require('express');
const { z } = require('zod');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicOrder, adminOrder } = require('../lib/serialize');

const router = express.Router();
router.use(requireAuth); // every route below needs a valid staff JWT

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// GET /api/admin/orders?status=received  - today's orders (plus any still-active older ones), newest first.
router.get('/orders', async (req, res) => {
  const status = z.enum(Order.STATUSES).optional().safeParse(req.query.status);
  if (!status.success) return res.status(400).json({ error: 'Invalid status filter' });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const filter = {
    restaurant: req.user.restaurantId,
    $or: [{ createdAt: { $gte: startOfToday } }, { status: { $in: Order.ACTIVE_STATUSES } }],
  };
  if (status.data) filter.status = status.data;

  const orders = await Order.find(filter).sort('-createdAt').limit(300).lean();
  res.json({ orders: orders.map(adminOrder) });
});

// Which current statuses may move to each new status. Anything else is rejected.
const ALLOWED_FROM = {
  preparing: ['received'],
  out_for_delivery: ['preparing'],
  delivered: ['out_for_delivery'],
  rejected: ['received', 'preparing'],
};

const statusSchema = z.object({
  status: z.enum(['preparing', 'out_for_delivery', 'delivered', 'rejected']),
  reason: z.string().trim().min(3, 'Please give a short reason').max(200).optional(), // required when rejecting
  prepMins: z.number().int().min(5).max(180).optional(), // set when accepting
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Order not found' });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { status, reason, prepMins } = parsed.data;
  if (status === 'rejected' && !reason) return res.status(400).json({ error: 'Please give a reason for rejecting this order.' });

  const set = { status };
  if (status === 'preparing' && prepMins) set.prepMins = prepMins;
  if (status === 'rejected') set.rejectReason = reason;

  // One atomic update: only succeeds if the order is still in an allowed state (no double-clicks / two staff racing).
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.user.restaurantId, status: { $in: ALLOWED_FROM[status] } },
    { $set: set, $push: { statusHistory: { status, at: new Date() } } },
    { returnDocument: 'after' },
  );
  if (!order) {
    const current = await Order.findOne({ _id: req.params.id, restaurant: req.user.restaurantId });
    if (!current) return res.status(404).json({ error: 'Order not found' });
    return res.status(409).json({ error: `This order is already "${current.status.replace(/_/g, ' ')}".`, order: adminOrder(current) });
  }

  const io = req.app.get('io');
  io.to(`restaurant:${order.restaurant}`).emit('order:updated', adminOrder(order)); // staff boards
  io.to(`order:${order._id}`).emit('order:updated', publicOrder(order)); // the guest's phone
  res.json({ order: adminOrder(order) });
});

const settingsOf = (r) => ({ name: r.name, isOpen: r.isOpen !== false, ordersPaused: !!r.ordersPaused });

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  const restaurant = await Restaurant.findById(req.user.restaurantId).lean();
  res.json({ settings: settingsOf(restaurant) });
});

const settingsSchema = z.object({ isOpen: z.boolean().optional(), ordersPaused: z.boolean().optional() })
  .refine((v) => v.isOpen !== undefined || v.ordersPaused !== undefined, 'Nothing to update');

// PATCH /api/admin/settings - anyone on staff can pause ordering; only owner/manager can close the restaurant.
router.patch('/settings', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings' });
  if (parsed.data.isOpen !== undefined && !['owner', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an owner or manager can open or close the restaurant.' });
  }
  const restaurant = await Restaurant.findByIdAndUpdate(req.user.restaurantId, { $set: parsed.data }, { returnDocument: 'after' });
  const settings = settingsOf(restaurant);
  req.app.get('io').to(`restaurant:${restaurant._id}`).emit('settings:updated', settings); // keep other tablets in sync
  res.json({ settings });
});

module.exports = router;
