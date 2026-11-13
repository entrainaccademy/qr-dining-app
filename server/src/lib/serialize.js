// What each audience may see about an order.

// Guests: no phone number, no internal ids beyond the (unguessable) order id.
function publicOrder(o) {
  return {
    id: o._id, orderNumber: o.orderNumber, roomNumber: o.roomNumber, status: o.status,
    items: o.items.map((i) => ({ name: i.name, isVeg: i.isVeg, qty: i.qty, addOns: i.addOns, note: i.note, lineTotal: i.lineTotal })),
    subtotal: o.subtotal, tax: o.tax, total: o.total, notes: o.notes, guestName: o.guestName,
    paymentMethod: o.paymentMethod, prepMins: o.prepMins, rejectReason: o.rejectReason,
    statusHistory: o.statusHistory, createdAt: o.createdAt, updatedAt: o.updatedAt,
  };
}

// Staff: everything a guest sees plus the guest's phone number.
function adminOrder(o) {
  return { ...publicOrder(o), guestPhone: o.guestPhone };
}

module.exports = { publicOrder, adminOrder };
