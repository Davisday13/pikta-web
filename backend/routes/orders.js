const express = require('express');
const { queryAll, queryOne, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function buildSucursalFilter(req, tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const isPrivileged = req.user.rol === 'Administrador' || req.user.rol === 'Supervisor';

  if (isPrivileged && req.query.sucursal_id) {
    return { where: `AND ${prefix}sucursal_id = ?`, params: [parseInt(req.query.sucursal_id)] };
  } else if (!isPrivileged) {
    return { where: `AND ${prefix}sucursal_id = ?`, params: [req.user.sucursal_id] };
  }
  return { where: '', params: [] };
}

router.get('/', async (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const orders = await queryAll(`SELECT * FROM pedidos WHERE estado NOT IN ('COBRADO', 'ENTREGADO', 'CANCELADO') ${filter.where} ORDER BY id DESC`, filter.params);
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });

    for (const order of parsed) {
      const extras = await queryAll('SELECT * FROM pedido_extras WHERE pedido_id = ? AND estado != ? ORDER BY id ASC', [order.id, 'ENTREGADO']);
      order.extras = extras.map(e => {
        try { e.items = JSON.parse(e.items); } catch(err) {}
        return e;
      });
    }

    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const orders = await queryAll(`SELECT * FROM pedidos WHERE pagado = false AND canal IN ('MESERO', 'LLEVAR', 'Móvil') ${filter.where} ORDER BY created_at DESC`, filter.params);
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { search, fecha } = req.query;
    const filter = buildSucursalFilter(req);
    let query = 'SELECT * FROM pedidos WHERE pagado = true';
    const params = [];

    if (search) {
      query += ' AND (numero ILIKE ? OR mesa ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (fecha) {
      query += ' AND created_at ILIKE ?';
      params.push(`${fecha}%`);
    }
    if (filter.where) {
      query += ` ${filter.where}`;
      params.push(...filter.params);
    }
    query += ' ORDER BY created_at DESC LIMIT 200';

    const orders = await queryAll(query, params);
    const parsed = orders.map(o => {
      try { o.items = JSON.parse(o.items); } catch(e) {}
      return o;
    });
    res.json({ status: 'success', data: parsed });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, mesa, total, canal, usuario_id, cliente_nombre, cliente_telefono, sesion_id } = req.body;
    const numero = `${(canal || 'PED').substring(0, 3).toUpperCase()}-${Date.now()}`;
    const created_at = new Date().toISOString();

    const result = await runSql(
      `INSERT INTO pedidos (numero, cliente_nombre, cliente_telefono, items, subtotal, total, estado, canal, mesa, usuario_id, sesion_id, created_at, sucursal_id)
       VALUES (?, ?, ?, ?, ?, ?, 'RECIBIDO', ?, ?, ?, ?, ?, ?)`,
      [numero, cliente_nombre || null, cliente_telefono || null, JSON.stringify(items), total, total, canal || 'CAJA', mesa || 'Mesa General', usuario_id || null, sesion_id || null, created_at, req.user.sucursal_id]
    );

    res.status(201).json({ status: 'success', message: 'Pedido creado', numero, order_id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { estado, metodo_pago, pagado, sesion_id } = req.body;

    if (estado === 'PREPARANDO') {
      await runSql('UPDATE pedidos SET estado = ?, preparacion_inicio = ? WHERE id = ?',
        [estado, new Date().toISOString(), req.params.id]);
    } else if (estado) {
      await runSql('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    }

    if (metodo_pago !== undefined) {
      await runSql('UPDATE pedidos SET metodo_pago = ? WHERE id = ?', [metodo_pago, req.params.id]);
    }
    if (pagado !== undefined) {
      await runSql('UPDATE pedidos SET pagado = ? WHERE id = ?', [pagado ? true : false, req.params.id]);
    }
    if (sesion_id !== undefined) {
      await runSql('UPDATE pedidos SET sesion_id = ? WHERE id = ?', [sesion_id, req.params.id]);
    }

    res.json({ status: 'success', message: 'Pedido actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/extras', async (req, res) => {
  try {
    const { items, total } = req.body;
    const order = await queryOne('SELECT id FROM pedidos WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ status: 'error', message: 'Pedido no encontrado' });

    const result = await runSql(
      'INSERT INTO pedido_extras (pedido_id, items, total, estado, created_at, sucursal_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, JSON.stringify(items), total, 'RECIBIDO', new Date().toISOString(), req.user.sucursal_id]
    );

    res.status(201).json({ status: 'success', message: 'Extra enviado a cocina', extra_id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/extras/:extraId', async (req, res) => {
  try {
    const { estado } = req.body;
    if (estado === 'PREPARANDO') {
      await runSql('UPDATE pedido_extras SET estado = ? WHERE id = ?',
        [estado, req.params.extraId]);
    } else if (estado) {
      await runSql('UPDATE pedido_extras SET estado = ? WHERE id = ?', [estado, req.params.extraId]);
    }
    res.json({ status: 'success', message: 'Extra actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/pay', async (req, res) => {
  try {
    const { metodo_pago, sesion_id } = req.body;
    await runSql('UPDATE pedidos SET pagado = true, metodo_pago = ?, sesion_id = ? WHERE id = ?',
      [metodo_pago || 'EFECTIVO', sesion_id || null, req.params.id]);
    res.json({ status: 'success', message: 'Pedido cobrado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await runSql('UPDATE pedidos SET estado = ? WHERE id = ?', ['CANCELADO', req.params.id]);
    res.json({ status: 'success', message: 'Pedido cancelado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
