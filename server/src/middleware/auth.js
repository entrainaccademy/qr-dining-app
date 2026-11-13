const jwt = require('jsonwebtoken');

const ALGO = 'HS256';

function signToken(user) {
  return jwt.sign(
    { role: user.role, restaurantId: String(user.restaurant), name: user.name },
    process.env.JWT_SECRET,
    { subject: String(user._id), expiresIn: '12h', algorithm: ALGO },
  );
}

// Throws if the token is missing, tampered with or expired. Returns the staff identity.
function verifyToken(token) {
  const p = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGO] });
  return { id: p.sub, role: p.role, restaurantId: p.restaurantId, name: p.name };
}

// Express middleware: requires "Authorization: Bearer <jwt>".
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}

// Express middleware factory: only the listed roles may continue.
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do that.' });

module.exports = { signToken, verifyToken, requireAuth, requireRole };
