const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const PRINT_SERVER_URL = process.env.PRINT_SERVER_URL || 'http://localhost:3001';

async function forwardToPrintServer(endpoint, data) {
  const response = await fetch(`${PRINT_SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

router.post('/kitchen', async (req, res) => {
  try {
    const { order_id, canal, items, total, created_at } = req.body;
    const result = await forwardToPrintServer('/print/kitchen', {
      order_id, canal, items, total, created_at
    });
    res.json(result);
  } catch (err) {
    console.error('Print kitchen error:', err.message);
    res.status(500).json({ status: 'error', message: 'Error de impresión: ' + err.message });
  }
});

router.post('/receipt', async (req, res) => {
  try {
    const { order_id, canal, items, total, metodo_pago, monto_recibido, cambio, created_at } = req.body;
    const result = await forwardToPrintServer('/print/receipt', {
      order_id, canal, items, total, metodo_pago, monto_recibido, cambio, created_at
    });
    res.json(result);
  } catch (err) {
    console.error('Print receipt error:', err.message);
    res.status(500).json({ status: 'error', message: 'Error de impresión: ' + err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/health`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ status: 'offline', message: 'Print server no disponible. Ejecuta el print server en tu PC.' });
  }
});

module.exports = router;
