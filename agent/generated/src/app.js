const express = require('express');
const cors = require('cors');
const path = require('path');

const gameRoutes = require('./game/gameRoutes');
const questionRoutes = require('./question/questionRoutes');
const userRoutes = require('./user/userRoutes');

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- API Routes ----------
app.use('/api/game', gameRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Space Fractions API is running', timestamp: new Date().toISOString() });
});

// ---------- SPA fallback ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ---------- Error handler ----------
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
