const express = require('express');
const { queryAll, queryOne, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const orders = queryAll("SELECT * FROM pedidos WHERE estado NOT IN ('COBRADO', 'ENTREGADO', 'CANCELADO') ORDER BY id DESC");
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/pending', (req, res) => {
  try {
    const orders = queryAll("SELECT * FROM pedidos WHERE pagado = 0 AND canal IN ('MESERO', 'LLEVAR', 'Móvil') ORDER BY created_at DESC");
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const { search, fecha } = req.query;
    let query = 'SELECT * FROM pedidos WHERE pagado = 1';
    const params = [];

    if (search) {
      query += ' AND (numero LIKE ? OR mesa LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (fecha) {
      query += ' AND created_at LIKE ?';
      params.push(`${fecha}%`);
    }
    query += ' ORDER BY created_at DESC LIMIT 200';

    const orders = queryAll(query, params);
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { items, mesa, total, canal, usuario_id, cliente_nombre, cliente_telefono, sesion_id } = req.body;
    const numero = `${(canal || 'PED').substring(0, 3).toUpperCase()}-${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = runSql(
      `INSERT INTO pedidos (numero, cliente_nombre, cliente_telefono, items, subtotal, total, estado, canal, mesa, usuario_id, sesion_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'RECIBIDO', ?, ?, ?, ?, ?)`,
      [numero, cliente_nombre || null, cliente_telefono || null, JSON.stringify(items), total, total, canal || 'CAJA', mesa || 'Mesa General', usuario_id || null, sesion_id || null, created_at]
    );

    res.status(201).json({ status: 'success', message: 'Pedido creado', numero });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { estado, metodo_pago, pagado, sesion_id } = req.body;

    if (estado === 'PREPARANDO') {
      runSql('UPDATE pedidos SET estado = ?, preparacion_inicio = ? WHERE id = ?',
        [estado, new Date().toISOString(), req.params.id]);
    } else if (estado) {
      runSql('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    }

    if (metodo_pago !== undefined) {
      runSql('UPDATE pedidos SET metodo_pago = ? WHERE id = ?', [metodo_pago, req.params.id]);
    }
    if (pagado !== undefined) {
      runSql('UPDATE pedidos SET pagado = ? WHERE id = ?', [pagado ? 1 : 0, req.params.id]);
    }
    if (sesion_id !== undefined) {
      runSql('UPDATE pedidos SET sesion_id = ? WHERE id = ?', [sesion_id, req.params.id]);
    }

    res.json({ status: 'success', message: 'Pedido actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/extras', (req, res) => {
  try {
    const { items, total } = req.body;
    const order = queryOne('SELECT items, total FROM pedidos WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ status: 'error', message: 'Pedido no encontrado' });

    const currentItems = JSON.parse(order.items);
    const newItems = currentItems.concat(items);
    const newTotal = parseFloat(order.total) + parseFloat(total);

    runSql('UPDATE pedidos SET items = ?, total = ?, estado = ? WHERE id = ?',
      [JSON.stringify(newItems), newTotal, 'RECIBIDO', req.params.id]);

    res.json({ status: 'success', message: 'Productos agregados correctamente' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/pay', (req, res) => {
  try {
    const { metodo_pago, sesion_id } = req.body;
    runSql('UPDATE pedidos SET pagado = 1, metodo_pago = ?, sesion_id = ? WHERE id = ?',
      [metodo_pago || 'EFECTIVO', sesion_id || null, req.params.id]);
    res.json({ status: 'success', message: 'Pedido cobrado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    runSql('UPDATE pedidos SET estado = ? WHERE id = ?', ['CANCELADO', req.params.id]);
    res.json({ status: 'success', message: 'Pedido cancelado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
