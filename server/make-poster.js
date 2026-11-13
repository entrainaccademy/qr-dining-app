// Generates printable A5 "scan to order" room cards (vector PDF) with a QR code.
//   npm run poster -- 101         -> qr-output/poster-room-101.pdf
//   npm run poster -- --lan 101   -> QR points at this PC's Wi-Fi address (for phone testing)
//   npm run poster                -> one PDF per room, plus posters-all.pdf (one page per room, ready to print)
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const Room = require('./src/models/Room');
const Hotel = require('./src/models/Hotel');
const Restaurant = require('./src/models/Restaurant');
const { parseArgs } = require('./qr-common');

const OUT_DIR = path.join(__dirname, 'qr-output');

// Keep in sync with client/src/config/brand.ts (colors).
const C = {
  bg: '#F6F2E9', surface: '#FFFEFB', ink: '#14231E', muted: '#5C6862',
  accent: '#1F5F4B', accentDark: '#164A3A', accentSoft: '#E1EDE5', brass: '#B08D4C',
};

const W = 419.53; // A5 portrait, in points
const H = 595.28;
const CX = W / 2;

// Draws a QR code as crisp vector squares.
function drawQr(doc, text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const m = size / n;
  doc.fillColor(C.ink);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) doc.rect(x + c * m, y + r * m, m + 0.25, m + 0.25).fill();
    }
  }
}

// The lifted dome ("cloche") above the QR.
function drawCloche(doc) {
  const base = 108;
  // soft shadow under the floating lid
  doc.save().fillOpacity(0.1).ellipse(CX, base + 14, 92, 5).fill(C.ink).restore();
  // dome
  doc.path(`M ${CX - 86} ${base} C ${CX - 86} ${base - 66} ${CX - 44} ${base - 80} ${CX} ${base - 80} C ${CX + 44} ${base - 80} ${CX + 86} ${base - 66} ${CX + 86} ${base} Z`).fill(C.accent);
  // highlight sweep
  doc.save().lineWidth(5).lineCap('round').strokeOpacity(0.22)
    .path(`M ${CX - 66} ${base - 16} C ${CX - 66} ${base - 50} ${CX - 40} ${base - 62} ${CX - 14} ${base - 66}`).stroke('#FFFFFF').restore();
  // rim + knob
  doc.roundedRect(CX - 100, base - 2, 200, 9, 4.5).fill(C.brass);
  doc.roundedRect(CX - 3.5, base - 92, 7, 14, 2).fill(C.brass);
  doc.circle(CX, base - 96, 8).fill(C.brass);
}

// A bowl of food below the QR.
function drawBowl(doc) {
  const top = 362;
  doc.save().fillOpacity(0.12).ellipse(CX, top + 36, 100, 8).fill(C.ink).restore();
  doc.path(`M ${CX - 92} ${top} C ${CX - 86} ${top + 40} ${CX + 86} ${top + 40} ${CX + 92} ${top} Z`).fill(C.accent);
  doc.ellipse(CX, top, 92, 15).fill(C.accentDark);
  doc.ellipse(CX, top + 1, 83, 11).fill('#8A5427');
  // dish contents: a mound with nuts and herbs
  doc.ellipse(CX, top - 5, 52, 13).fill('#6E3F1C');
  const bits = [[-30, -9, '#C99A3E'], [-12, -14, '#E9DCC0'], [8, -12, '#C99A3E'], [26, -7, '#5F8F4E'], [-2, -6, '#4A2A12'], [-38, -3, '#4A2A12'], [14, -3, '#E9DCC0'], [34, -2, '#C99A3E']];
  for (const [dx, dy, col] of bits) doc.circle(CX + dx, top + dy, 4.2).fill(col);
}

function drawPoster(doc, { link, roomNumber, hotelName, restaurantName, tagline }) {
  doc.rect(0, 0, W, H).fill(C.bg);
  // thin brass frame
  doc.lineWidth(0.8).roundedRect(14, 14, W - 28, H - 28, 10).stroke(C.brass);

  drawCloche(doc);

  // white backing keeps the QR reliable to scan, whatever the paper colour
  const qr = 168;
  const qx = CX - qr / 2;
  const qy = 150;
  doc.roundedRect(qx - 14, qy - 14, qr + 28, qr + 28, 12).fill(C.surface);
  doc.lineWidth(0.6).roundedRect(qx - 14, qy - 14, qr + 28, qr + 28, 12).stroke('#DCE0D3');
  drawQr(doc, link, qx, qy, qr);

  drawBowl(doc);

  // title
  doc.fillColor(C.ink).font('Times-Bold').fontSize(27)
    .text(restaurantName.toUpperCase(), 30, 418, { width: W - 60, align: 'center', characterSpacing: 1.2 });
  doc.moveTo(CX - 28, 454).lineTo(CX + 28, 454).lineWidth(1.5).stroke(C.brass);

  doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(12.5)
    .text('SCAN TO ORDER IN-ROOM DINING', 30, 466, { width: W - 60, align: 'center', characterSpacing: 1.6 });
  doc.fillColor(C.muted).font('Times-Italic').fontSize(12)
    .text(tagline || 'Fresh from our kitchen to your door.', 60, 486, { width: W - 120, align: 'center' });

  // room badge
  const label = `ROOM ${roomNumber}  •  ${hotelName.toUpperCase()}`;
  doc.font('Helvetica-Bold').fontSize(9.5);
  const bw = doc.widthOfString(label, { characterSpacing: 1.4 }) + 36;
  doc.roundedRect(CX - bw / 2, 522, bw, 26, 13).fill(C.accent);
  doc.fillColor('#FFFFFF').text(label, CX - bw / 2, 530, { width: bw, align: 'center', characterSpacing: 1.4 });

  doc.fillColor(C.muted).font('Helvetica').fontSize(8)
    .text('Open your phone camera and point it at the code. No app or login needed.', 30, 562, { width: W - 60, align: 'center' });
}

function render(file, pages) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: 'In-room dining QR card' } });
    const out = fs.createWriteStream(file);
    doc.pipe(out);
    pages.forEach((p, i) => {
      if (i > 0) doc.addPage({ size: [W, H], margin: 0 });
      drawPoster(doc, p);
    });
    doc.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

async function main() {
  const { base, wanted } = parseArgs();
  await connectDB();

  const query = wanted.length ? { number: { $in: wanted } } : {};
  const rooms = (await Room.find(query).lean()).sort((a, b) => Number(a.number) - Number(b.number));
  if (!rooms.length) throw new Error(wanted.length ? `No rooms found for: ${wanted.join(', ')}` : 'No rooms in the database. Run npm run seed first.');

  const hotel = await Hotel.findById(rooms[0].hotel).lean();
  const restaurant = await Restaurant.findById(rooms[0].restaurant).lean();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pages = rooms.map((r) => ({
    link: `${base}/menu?t=${r.token}`, roomNumber: r.number,
    hotelName: hotel.name, restaurantName: restaurant.name, tagline: restaurant.tagline,
  }));

  for (const p of pages) {
    await render(path.join(OUT_DIR, `poster-room-${p.roomNumber}.pdf`), [p]);
    console.log(`Room ${p.roomNumber}: ${p.link}`);
  }
  if (pages.length > 1) {
    await render(path.join(OUT_DIR, 'posters-all.pdf'), pages);
    console.log(`\nCombined print file: ${path.join(OUT_DIR, 'posters-all.pdf')}`);
  }
  console.log(`\nWrote ${pages.length} poster(s) to ${OUT_DIR}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error('make-poster failed:', e.message); process.exit(1); });
