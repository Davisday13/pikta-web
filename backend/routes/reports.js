const express = require('express');
const { queryAll } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/sales', (req, res) => {
  try {
    const { fecha } = req.query;
    let query = "SELECT * FROM pedidos WHERE pagado = 1";
    const params = [];
    if (fecha) {
      query += " AND created_at LIKE ?";
      params.push(`${fecha}%`);
    }
    query += " ORDER BY created_at DESC";
    const orders = queryAll(query, params);

    const totalVentas = orders.reduce((s, o) => s + (o.total || 0), 0);
    const efectivo = orders.filter(o => o.metodo_pago === 'EFECTIVO').reduce((s, o) => s + (o.total || 0), 0);
    const otros = orders.filter(o => o.metodo_pago !== 'EFECTIVO').reduce((s, o) => s + (o.total || 0), 0);

    res.json({
      status: 'success',
      data: {
        total_ventas: Math.round(totalVentas * 100) / 100,
        efectivo: Math.round(efectivo * 100) / 100,
        otros: Math.round(otros * 100) / 100,
        total_tickets: orders.length,
        pedidos: orders.map(o => {
          try { o.items = JSON.parse(o.items); } catch(e) {}
          return o;
        })
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/daily-summary', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const orderStats = queryAll("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM pedidos WHERE pagado = 1 AND created_at LIKE ?", [`${today}%`]);
    const activeOrders = queryAll("SELECT COUNT(*) as count FROM pedidos WHERE estado NOT IN ('COBRADO', 'ENTREGADO', 'CANCELADO')");
    const lowStock = queryAll("SELECT COUNT(*) as count FROM inventario WHERE cantidad <= stock_minimo AND stock_minimo > 0");

    res.json({
      status: 'success',
      data: {
        ventas_hoy: orderStats[0]?.count || 0,
        total_hoy: orderStats[0]?.total || 0,
        pedidos_activos: activeOrders[0]?.count || 0,
        stock_bajo: lowStock[0]?.count || 0
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
