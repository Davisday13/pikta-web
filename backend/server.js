require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupDb } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Start server after DB init
async function start() {
  await setupDb();

  // Routes
  app.use('/api/login', require('./routes/auth'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/inventory', require('./routes/inventory'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/cash', require('./routes/cash'));
  app.use('/api/reports', require('./routes/reports'));

  // Health check
  app.get('/api/status', (req, res) => {
    res.json({ status: 'success', message: "PIK'TA POS API Web funcionando", version: '1.0.0' });
  });

  // Serve static frontend in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PIK'TA POS API Web corriendo en puerto ${PORT}`);
  });
}

start().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});
