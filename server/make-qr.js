// Generates plain QR code PNGs for room links.
//   npm run qr                 -> all rooms
//   npm run qr -- 101 102      -> only those rooms
//   npm run qr -- --lan        -> use this PC's LAN IP (so a phone on the same Wi-Fi can scan)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Room = require('./src/models/Room');
const { parseArgs } = require('./qr-common');

const OUT_DIR = path.join(__dirname, 'qr-output');

async function main() {
  const { base, wanted } = parseArgs();

  await connectDB();
  const query = wanted.length ? { number: { $in: wanted } } : {};
  const rooms = (await Room.find(query).lean()).sort((a, b) => Number(a.number) - Number(b.number));
  if (!rooms.length) throw new Error(wanted.length ? `No rooms found for: ${wanted.join(', ')}` : 'No rooms in the database. Run npm run seed first.');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const room of rooms) {
    const link = `${base}/menu?t=${room.token}`;
    const file = path.join(OUT_DIR, `room-${room.number}.png`);
    await QRCode.toFile(file, link, { type: 'png', width: 600, margin: 2, errorCorrectionLevel: 'M' });
    console.log(`Room ${room.number}: ${link}`);
  }
  console.log(`\nWrote ${rooms.length} QR code(s) to ${OUT_DIR}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('make-qr failed:', e.message); process.exit(1); });
