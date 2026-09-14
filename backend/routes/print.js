const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory pending print jobs (resets on redeploy, which is fine)
const pendingJobs = [];
let jobIdCounter = 1;

// Direct print (for when print server is directly accessible)
router.post('/kitchen', authMiddleware, async (req, res) => {
  try {
    const { order_id, canal, items, total } = req.body;
    const PRINT_SERVER_URL = process.env.PRINT_SERVER_URL;

    if (PRINT_SERVER_URL) {
      const response = await fetch(`${PRINT_SERVER_URL}/print/kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id, canal, items, total })
      });
      const result = await response.json();
      return res.json(result);
    }

    // If no print server URL, queue for polling
    const job = {
      id: jobIdCounter++,
      type: 'kitchen',
      order_id, canal, items, total,
      created_at: new Date().toISOString()
    };
    pendingJobs.push(job);
    res.json({ status: 'queued', job_id: job.id });
  } catch (err) {
    console.error('Print kitchen error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Direct print receipt
router.post('/receipt', authMiddleware, async (req, res) => {
  try {
    const { order_id, canal, items, total, metodo_pago, monto_recibido, cambio } = req.body;
    const PRINT_SERVER_URL = process.env.PRINT_SERVER_URL;

    if (PRINT_SERVER_URL) {
      const response = await fetch(`${PRINT_SERVER_URL}/print/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id, canal, items, total, metodo_pago, monto_recibido, cambio })
      });
      const result = await response.json();
      return res.json(result);
    }

    // Queue for polling
    const job = {
      id: jobIdCounter++,
      type: 'receipt',
      order_id, canal, items, total, metodo_pago, monto_recibido, cambio,
      created_at: new Date().toISOString()
    };
    pendingJobs.push(job);
    res.json({ status: 'queued', job_id: job.id });
  } catch (err) {
    console.error('Print receipt error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get pending jobs (for local print server polling)
router.get('/pending', (req, res) => {
  res.json({ status: 'success', data: pendingJobs });
});

// Mark job as printed
router.post('/printed', (req, res) => {
  const { job_id } = req.body;
  const idx = pendingJobs.findIndex(j => j.id === job_id);
  if (idx !== -1) {
    pendingJobs.splice(idx, 1);
  }
  res.json({ status: 'success' });
});

// Check print server status
router.get('/status', authMiddleware, async (req, res) => {
  const PRINT_SERVER_URL = process.env.PRINT_SERVER_URL;
  if (!PRINT_SERVER_URL) {
    return res.json({ status: 'offline', message: 'PRINT_SERVER_URL no configurada en Render' });
  }
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/health`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ status: 'offline', message: 'Print server no disponible' });
  }
});

module.exports = router;
