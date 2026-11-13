require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { verifyToken } = require('./middleware/auth');

if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is not set in server/.env'); process.exit(1); }

const app = express();
const server = http.createServer(app);

const { origin: corsOrigin } = require('./config/origins');
const io = new Server(server, { cors: { origin: corsOrigin } });
app.set('io', io); // routes emit events via req.app.get('io')

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '50kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// Express 5 forwards async errors here automatically.
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

// Socket auth. A socket may present a staff JWT in the handshake: a valid one auto-joins restaurant:{id}
// (the staff room that receives order:new / order:updated); an invalid one is refused outright.
// A socket with no token is a guest and can only join order:{id} rooms.
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next();
  try {
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  if (socket.data.user) socket.join(`restaurant:${socket.data.user.restaurantId}`);

  // Guests track their own order by its unguessable id.
  socket.on('join:order', (orderId) => {
    if (/^[a-f\d]{24}$/i.test(String(orderId))) socket.join(`order:${orderId}`);
  });
});

const port = process.env.PORT || 5000;
connectDB()
  .then(() => server.listen(port, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${port}`)))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
