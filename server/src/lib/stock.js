// Stock counting. MenuItem.stock is a number of portions left, or null when the item isn't tracked.
const MenuItem = require('../models/MenuItem');

// Total quantity per menu item (the same dish can appear on two lines with different add-ons).
function totals(lines) {
  const map = new Map();
  for (const l of lines) map.set(String(l.menuItem), (map.get(String(l.menuItem)) || 0) + l.qty);
  return map;
}

// Takes stock for every tracked item. If any item can't be covered, everything taken so far is put back.
// Returns { ok: true } or { ok: false, name }.
async function reserveStock(lines, itemsById) {
  const taken = [];
  for (const [id, qty] of totals(lines)) {
    const item = itemsById.get(id);
    if (typeof item.stock !== 'number') continue; // not tracked
    // Atomic: the filter and the decrement happen in one step, so the count can never go below zero.
    const res = await MenuItem.updateOne({ _id: id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (res.modifiedCount !== 1) {
      await restoreStock(taken);
      return { ok: false, name: item.name };
    }
    taken.push({ menuItem: id, qty });
  }
  return { ok: true };
}

// Gives portions back (order rejected/cancelled, or checkout failed). Only touches tracked items.
async function restoreStock(lines) {
  for (const [id, qty] of totals(lines)) {
    await MenuItem.updateOne({ _id: id, stock: { $type: 'number' } }, { $inc: { stock: qty } });
  }
}

module.exports = { reserveStock, restoreStock };
