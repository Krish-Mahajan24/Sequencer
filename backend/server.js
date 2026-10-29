const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const trackRoutes = require('./routes/trackRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const sequenceRoutes = require('./routes/sequenceRoutes');
const historyRoutes = require('./routes/historyRoutes');

// Initialize MongoDB Atlas connection
connectDB();

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve static frontend files if accessed via backend
const frontendPath = path.resolve(__dirname, '..', 'frontend');
app.use('/frontend', express.static(frontendPath));

// MVC View - API Documentation & Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Health check endpoint (for deployment monitoring e.g. Render/Railway)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const states = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'];

  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'ok' : 'unavailable',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: states[dbState] || 'Unknown',
    databaseName: mongoose.connection.name || null,
    version: '1.0.0',
    service: 'Sequencer API Backend',
  });
});

// Fail quickly instead of buffering requests while MongoDB is unavailable.
app.use('/api', async (req, res, next) => {
  if (!(await connectDB.waitUntilConnected())) {
    res.set('Retry-After', '3');
    return res.status(503).json({ success: false, message: 'The database connection is temporarily unavailable. Please try again shortly.' });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/sequences', sequenceRoutes);
app.use('/api/history', historyRoutes);

// Error Middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5050;

const server = app.listen(PORT, () => {
  console.log(`🚀 Sequencer Backend running on port ${PORT}`);
  console.log(`📊 API View Dashboard: http://localhost:${PORT}`);
  console.log(`🎵 Frontend Web App:   http://localhost:${PORT}/frontend/index.html`);
});

module.exports = app;
