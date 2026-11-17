const express = require('express');
const { z } = require('zod');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const { requireAuth, requireRole } = require('../middleware/auth');
const { publicOrder, adminOrder } = require('../lib/serialize');
const { kitchenState } = require('../lib/hours');
const { restoreStock } = require('../lib/stock');

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

  if (status === 'rejected') await restoreStock(order.items); // rejected order: put its portions back on the shelf

  const io = req.app.get('io');
  io.to(`restaurant:${order.restaurant}`).emit('order:updated', adminOrder(order)); // staff boards
  io.to(`order:${order._id}`).emit('order:updated', publicOrder(order)); // the guest's phone
  res.json({ order: adminOrder(order) });
});

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time like 07:00');

const settingsOf = (r) => ({
  name: r.name, isOpen: r.isOpen !== false, ordersPaused: !!r.ordersPaused,
  hours: { enabled: !!(r.hours && r.hours.enabled), open: (r.hours && r.hours.open) || '07:00', close: (r.hours && r.hours.close) || '23:30' },
  kitchen: kitchenState(r), // what guests see right now, so the board can show the same thing
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  const restaurant = await Restaurant.findById(req.user.restaurantId).lean();
  res.json({ settings: settingsOf(restaurant) });
});

const settingsSchema = z.object({
  isOpen: z.boolean().optional(),
  ordersPaused: z.boolean().optional(),
  hours: z.object({ enabled: z.boolean(), open: HHMM, close: HHMM }).optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to update');

// PATCH /api/admin/settings - anyone on staff can pause ordering; only owner/manager can close the restaurant or change hours.
router.patch('/settings', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { isOpen, ordersPaused, hours } = parsed.data;
  if ((isOpen !== undefined || hours) && !['owner', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an owner or manager can change opening hours or close the restaurant.' });
  }
  const set = {};
  if (isOpen !== undefined) set.isOpen = isOpen;
  if (ordersPaused !== undefined) set.ordersPaused = ordersPaused;
  if (hours) set.hours = hours;
  const restaurant = await Restaurant.findByIdAndUpdate(req.user.restaurantId, { $set: set }, { returnDocument: 'after' });
  const settings = settingsOf(restaurant);
  req.app.get('io').to(`restaurant:${restaurant._id}`).emit('settings:updated', settings); // keep other tablets in sync
  res.json({ settings });
});

// ---------- Menu management (owner/manager only, except quick stock controls) ----------
const manage = requireRole('owner', 'manager');

const categoryOut = (c) => ({ id: c._id, name: c.name, description: c.description || '', sortOrder: c.sortOrder });
// Staff see the real stock count; guests never do.
const itemOut = (i) => ({
  id: i._id, categoryId: i.category, name: i.name, description: i.description || '', price: i.price, isVeg: i.isVeg,
  image: i.image || '', available: i.available !== false, stock: typeof i.stock === 'number' ? i.stock : null, sortOrder: i.sortOrder,
  addOns: (i.addOns || []).map((a) => ({ id: a._id, name: a.name, price: a.price })),
});

// GET /api/admin/menu - every category and item, including sold-out ones. All staff may view (kitchen needs stock).
router.get('/menu', async (req, res) => {
  const [categories, items] = await Promise.all([
    Category.find({ restaurant: req.user.restaurantId }).sort('sortOrder').lean(),
    MenuItem.find({ restaurant: req.user.restaurantId }).sort('sortOrder').lean(),
  ]);
  res.json({ categories: categories.map(categoryOut), items: items.map(itemOut) });
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(120).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

router.post('/categories', manage, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const c = await Category.create({ ...parsed.data, restaurant: req.user.restaurantId });
  res.status(201).json({ category: categoryOut(c) });
});

router.patch('/categories/:id', manage, async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Category not found' });
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const c = await Category.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurantId }, { $set: parsed.data }, { returnDocument: 'after' });
  if (!c) return res.status(404).json({ error: 'Category not found' });
  res.json({ category: categoryOut(c) });
});

router.delete('/categories/:id', manage, async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Category not found' });
  // Refuse to delete a category that still has dishes, so nothing disappears by accident.
  if (await MenuItem.exists({ category: req.params.id, restaurant: req.user.restaurantId })) {
    return res.status(409).json({ error: 'Move or delete the dishes in this category first.' });
  }
  const c = await Category.findOneAndDelete({ _id: req.params.id, restaurant: req.user.restaurantId });
  if (!c) return res.status(404).json({ error: 'Category not found' });
  res.json({ ok: true });
});

const itemSchema = z.object({
  categoryId: objectId,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  price: z.number().min(0).max(100000), // INR, before GST
  isVeg: z.boolean(),
  image: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\//.test(v) || v.startsWith('/'), 'Image must be a link').optional(),
  available: z.boolean().optional(),
  stock: z.number().int().min(0).max(100000).nullable().optional(), // null = don't track
  sortOrder: z.number().int().min(0).max(9999).optional(),
  addOns: z.array(z.object({ name: z.string().trim().min(1).max(60), price: z.number().min(0).max(100000) })).max(15).optional(),
});

// Rejects a categoryId that belongs to another restaurant.
const ownsCategory = (id, restaurant) => Category.exists({ _id: id, restaurant });

router.post('/items', manage, async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { categoryId, ...rest } = parsed.data;
  if (!(await ownsCategory(categoryId, req.user.restaurantId))) return res.status(400).json({ error: 'Unknown category' });
  const item = await MenuItem.create({ ...rest, category: categoryId, restaurant: req.user.restaurantId });
  res.status(201).json({ item: itemOut(item) });
});

// PATCH /api/admin/items/:id/stock - the quick controls the kitchen uses all day. Open to every staff role.
// (Declared before /items/:id so the longer path is matched first.)
const stockSchema = z.object({ available: z.boolean().optional(), stock: z.number().int().min(0).max(100000).nullable().optional() })
  .refine((v) => v.available !== undefined || v.stock !== undefined, 'Nothing to update');
router.patch('/items/:id/stock', async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Item not found' });
  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const item = await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurantId }, { $set: parsed.data }, { returnDocument: 'after' });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item: itemOut(item) });
});

router.patch('/items/:id', manage, async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Item not found' });
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { categoryId, ...rest } = parsed.data;
  if (categoryId) {
    if (!(await ownsCategory(categoryId, req.user.restaurantId))) return res.status(400).json({ error: 'Unknown category' });
    rest.category = categoryId;
  }
  const item = await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurantId }, { $set: rest }, { returnDocument: 'after' });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item: itemOut(item) });
});

// Deleting a dish is safe for history: past orders keep their own snapshot of name and price.
router.delete('/items/:id', manage, async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Item not found' });
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, restaurant: req.user.restaurantId });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
});

module.exports = router;
