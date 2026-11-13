// Builds the CORS / Socket.io origin check from CLIENT_URL (one URL or a comma-separated list).
const list = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

// In development only, also trust private LAN addresses on port 3000 so a phone on the
// same Wi-Fi can use the app without editing CLIENT_URL every time the PC's IP changes.
const LAN = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):3000$/;
const isDev = process.env.NODE_ENV !== 'production';

function originAllowed(origin) {
  if (!origin) return true; // same-origin / curl / server-to-server
  return list.includes(origin) || (isDev && LAN.test(origin));
}

// Function form works for both the `cors` package and Socket.io.
const origin = (o, cb) => cb(null, originAllowed(o));

module.exports = { origin, list };
