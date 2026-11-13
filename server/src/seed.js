// Clears and reseeds the database with demo data. Run: npm run seed
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Hotel = require('./models/Hotel');
const Restaurant = require('./models/Restaurant');
const Room = require('./models/Room');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const User = require('./models/User');

// Placeholder food photos by keyword (loremflickr). Replace with real photography later.
const img = (kw) => `https://loremflickr.com/600/400/${kw},food`;
const PORTION = (p) => ({ name: 'Extra portion', price: p });

// [name, description, price, isVeg, image keywords, addOns]
const MENU = {
  Starters: [
    ['Paneer Tikka', 'Cottage cheese marinated in spiced yoghurt, charred in the tandoor', 320, true, 'paneer,tikka', [{ name: 'Mint chutney', price: 20 }]],
    ['Hara Bhara Kebab', 'Spinach, peas and potato patties with fresh herbs', 260, true, 'kebab,spinach', []],
    ['Chicken 65', 'Crisp South Indian fried chicken with curry leaf and chilli', 340, false, 'fried,chicken', [PORTION(120)]],
    ['Tandoori Prawns', 'Jumbo prawns with ajwain and lemon, tandoor grilled', 480, false, 'prawns,grilled', []],
    ['Tomato Basil Soup', 'Roasted tomato velouté with basil oil and croutons', 190, true, 'tomato,soup', [{ name: 'Garlic bread', price: 60 }]],
    ['Crispy Corn Salt & Pepper', 'Golden fried sweet corn with peppers and spring onion', 240, true, 'crispy,corn', []],
  ],
  Mains: [
    ['Butter Chicken', 'Tandoori chicken in a silky tomato-butter gravy', 420, false, 'butter,chicken', [PORTION(150)]],
    ['Dal Makhani', 'Black lentils slow-cooked overnight with cream and butter', 330, true, 'dal,makhani', []],
    ['Paneer Butter Masala', 'Paneer cubes in a rich cashew-tomato gravy', 370, true, 'paneer,curry', [PORTION(130)]],
    ['Lamb Rogan Josh', 'Kashmiri-style lamb braised with whole spices', 520, false, 'lamb,curry', []],
    ['Hyderabadi Chicken Biryani', 'Dum-cooked basmati with marinated chicken, served with raita', 460, false, 'chicken,biryani', [{ name: 'Extra raita', price: 40 }]],
    ['Vegetable Dum Biryani', 'Seasonal vegetables and saffron rice, sealed and slow-cooked', 360, true, 'vegetable,biryani', [{ name: 'Extra raita', price: 40 }]],
    ['Grilled Fish with Lemon Butter', 'Catch of the day, herb butter, sautéed vegetables, mash', 550, false, 'grilled,fish', []],
    ['Penne Arrabbiata', 'Penne in spicy tomato sauce with garlic and basil', 340, true, 'penne,pasta', [{ name: 'Add chicken', price: 100 }, { name: 'Extra cheese', price: 50 }]],
    ['Club Sandwich', 'Triple-decker with chicken, egg and fries', 360, false, 'club,sandwich', []],
  ],
  Breads: [
    ['Butter Naan', 'Leavened tandoor bread brushed with butter', 70, true, 'naan,bread', []],
    ['Garlic Naan', 'Naan topped with roasted garlic and coriander', 85, true, 'garlic,naan', []],
    ['Tandoori Roti', 'Whole wheat bread from the clay oven', 50, true, 'roti,bread', []],
    ['Laccha Paratha', 'Flaky layered whole wheat paratha', 80, true, 'paratha', []],
  ],
  Desserts: [
    ['Gulab Jamun', 'Warm milk dumplings in cardamom syrup (2 pcs)', 150, true, 'gulab,jamun', [{ name: 'Vanilla ice cream', price: 60 }]],
    ['Rasmalai', 'Soft paneer discs in saffron-pistachio milk (2 pcs)', 180, true, 'rasmalai', []],
    ['Chocolate Lava Cake', 'Molten centre, served warm with vanilla ice cream', 260, true, 'chocolate,cake', []],
    ['Kulfi Falooda', 'Traditional kulfi with rose vermicelli and basil seeds', 200, true, 'kulfi,dessert', []],
  ],
  Beverages: [
    ['Masala Chai', 'Assam tea brewed with ginger and cardamom', 90, true, 'masala,chai', []],
    ['Cold Coffee', 'Chilled blended coffee with ice cream', 160, true, 'cold,coffee', [{ name: 'Extra shot', price: 40 }]],
    ['Sweet Lassi', 'Thick chilled yoghurt drink', 130, true, 'lassi', []],
    ['Fresh Lime Soda', 'Sweet, salted or mixed', 110, true, 'lime,soda', []],
    ['Mineral Water (1L)', 'Still mineral water', 60, true, 'water,bottle', []],
  ],
};

const CATEGORY_NOTES = {
  Starters: 'Small plates from the tandoor and the wok, to begin the evening.',
  Mains: 'Slow-cooked gravies, dum biryanis and continental favourites.',
  Breads: 'Baked fresh in the clay oven, brought to you hot.',
  Desserts: 'Something sweet, in the old-world way.',
  Beverages: 'Chai, coolers and chilled things.',
};

async function main() {
  await connectDB();

  // Remember existing room tokens so reseeding doesn't invalidate QR codes already generated/printed.
  const oldTokens = new Map((await Room.find({}, 'number token').lean()).map((r) => [r.number, r.token]));

  // Clear everything this app owns.
  await Promise.all([Hotel, Restaurant, Room, Category, MenuItem, Order, User].map((M) => M.deleteMany({})));

  const hotel = await Hotel.create({ name: 'Grand Stay Hotel', address: 'MG Road, Bengaluru' });
  const restaurant = await Restaurant.create({
    hotel: hotel._id, name: 'Spice Route Kitchen', tagline: 'Flavours of India, delivered to your door', gstPercent: 5,
  });

  // Rooms 101-120 and 201-220, each with an unguessable token.
  const numbers = [];
  for (let i = 101; i <= 120; i++) numbers.push(String(i));
  for (let i = 201; i <= 220; i++) numbers.push(String(i));
  const rooms = await Room.insertMany(numbers.map((number) => ({
    hotel: hotel._id, restaurant: restaurant._id, number, token: oldTokens.get(number) || crypto.randomBytes(16).toString('base64url'),
  })));

  // Categories and items.
  const items = [];
  let catOrder = 0;
  for (const [catName, list] of Object.entries(MENU)) {
    const cat = await Category.create({ restaurant: restaurant._id, name: catName, description: CATEGORY_NOTES[catName], sortOrder: catOrder++ });
    list.forEach(([name, description, price, isVeg, kw, addOns], idx) => {
      items.push({ restaurant: restaurant._id, category: cat._id, name, description, price, isVeg, image: img(kw), addOns, sortOrder: idx });
    });
  }
  const menuItems = await MenuItem.insertMany(items);
  await MenuItem.updateOne({ name: 'Tandoori Prawns' }, { available: false }); // demo the Sold out state

  // Staff users. Demo passwords only - change before any real deployment.
  const staff = [
    { name: 'Olivia Owner', email: 'owner@grandstay.test', password: 'Owner@1234', role: 'owner' },
    { name: 'Manoj Manager', email: 'manager@grandstay.test', password: 'Manager@1234', role: 'manager' },
    { name: 'Kavita Kitchen', email: 'kitchen@grandstay.test', password: 'Kitchen@1234', role: 'kitchen' },
  ];
  for (const s of staff) {
    await User.create({ restaurant: restaurant._id, name: s.name, email: s.email, role: s.role, passwordHash: await bcrypt.hash(s.password, 10) });
  }

  // A few past delivered orders (for reports later).
  const byName = (n) => menuItems.find((m) => m.name === n);
  const samples = [
    { room: rooms[2], lines: [['Butter Chicken', 1], ['Butter Naan', 2]], daysAgo: 3 },
    { room: rooms[9], lines: [['Paneer Tikka', 1], ['Masala Chai', 2]], daysAgo: 2 },
    { room: rooms[25], lines: [['Hyderabadi Chicken Biryani', 2], ['Sweet Lassi', 2], ['Gulab Jamun', 1]], daysAgo: 1 },
    { room: rooms[31], lines: [['Penne Arrabbiata', 1], ['Cold Coffee', 1]], daysAgo: 1 },
  ];
  let n = 1000;
  for (const s of samples) {
    const lines = s.lines.map(([name, qty]) => {
      const m = byName(name);
      return { menuItem: m._id, name: m.name, isVeg: m.isVeg, unitPrice: m.price, qty, addOns: [], lineTotal: m.price * qty };
    });
    const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);
    const tax = Math.round(subtotal * 5) / 100;
    const at = new Date(Date.now() - s.daysAgo * 86400000);
    await Order.create({
      restaurant: restaurant._id, room: s.room._id, roomNumber: s.room.number, orderNumber: ++n,
      items: lines, subtotal, tax, total: subtotal + tax, status: 'delivered',
      statusHistory: ['received', 'preparing', 'out_for_delivery', 'delivered'].map((status, i) => ({ status, at: new Date(at.getTime() + i * 10 * 60000) })),
      createdAt: at, updatedAt: at,
    });
  }

  console.log(`Seeded: 1 hotel, ${rooms.length} rooms, 5 categories, ${menuItems.length} items, ${staff.length} users, ${samples.length} past orders\n`);
  console.log('Staff logins:');
  staff.forEach((s) => console.log(`  ${s.role.padEnd(8)} ${s.email}  /  ${s.password}`));
  console.log('\nFirst 3 room tokens:');
  rooms.slice(0, 3).forEach((r) => console.log(`  Room ${r.number}: ${r.token}`));

  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
