const mongoose = require('mongoose');

// Connects to MongoDB Atlas using MONGO_URI from .env (never logged).
async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in server/.env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
}

module.exports = connectDB;
