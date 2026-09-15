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

router.post('/open', (req, res) => {
  try {
    const { usuario_id, monto_inicial } = req.body;

    const existing = queryOne('SELECT id FROM caja_sesiones WHERE estado = ? AND sucursal_id = ? ORDER BY id DESC LIMIT 1', ['ABIERTO', req.user.sucursal_id]);
    if (existing) {
      return res.json({ status: 'success', message: 'Sesión de caja recuperada', sesion_id: existing.id });
    }

    const result = runSql(
      'INSERT INTO caja_sesiones (usuario_id, inicio, inicial, monto_apertura, estado, sucursal_id) VALUES (?, ?, ?, ?, ?, ?)',
      [usuario_id, new Date().toISOString(), monto_inicial || 0, monto_inicial || 0, 'ABIERTO', req.user.sucursal_id]
    );

    res.status(201).json({ status: 'success', message: 'Caja abierta', sesion_id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/close', (req, res) => {
  try {
    const { sesion_id } = req.body;

    let sid = sesion_id;
    if (!sid) {
      const open = queryOne('SELECT id FROM caja_sesiones WHERE estado = ? AND sucursal_id = ? ORDER BY id DESC LIMIT 1', ['ABIERTO', req.user.sucursal_id]);
      if (!open) return res.status(400).json({ status: 'error', message: 'No hay caja abierta' });
      sid = open.id;
    }

    const rows = queryAll('SELECT numero, total, metodo_pago, created_at FROM pedidos WHERE sesion_id = ? AND pagado = true', [sid]);
    const sumEfectivo = rows.filter(r => r.metodo_pago === 'EFECTIVO').reduce((s, r) => s + (r.total || 0), 0);
    const sumOtros = rows.filter(r => r.metodo_pago !== 'EFECTIVO').reduce((s, r) => s + (r.total || 0), 0);
    const sumTotal = sumEfectivo + sumOtros;

    const cajaRow = queryOne('SELECT inicial FROM caja_sesiones WHERE id = ?', [sid]);
    const inicial = cajaRow ? (cajaRow.inicial || 0) : 0;

    runSql('UPDATE caja_sesiones SET estado=?, cierre_total=?, cierre_at=?, ingresos_efectivo=?, ingresos_otros=? WHERE id=?',
      ['CERRADO', sumTotal, new Date().toISOString(), sumEfectivo, sumOtros, sid]);

    res.json({
      status: 'success',
      message: 'Caja cerrada',
      reporte: {
        sesion_id: sid,
        tickets: rows.length,
        monto_inicial: inicial,
        efectivo: Math.round(sumEfectivo * 100) / 100,
        yappy: Math.round(sumOtros * 100) / 100,
        total_ventas: Math.round(sumTotal * 100) / 100,
        total_en_caja: Math.round((sumEfectivo + inicial) * 100) / 100,
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/active', (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const session = queryOne(`SELECT * FROM caja_sesiones WHERE estado = ? ${filter.where} ORDER BY id DESC LIMIT 1`, ['ABIERTO', ...filter.params]);
    if (session) {
      res.json({ status: 'success', data: session });
    } else {
      res.json({ status: 'not_found' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const sessions = queryAll(`SELECT * FROM caja_sesiones WHERE 1=1 ${filter.where} ORDER BY id DESC LIMIT 50`, filter.params);
    res.json({ status: 'success', data: sessions });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/history/:id', (req, res) => {
  try {
    const session = queryOne(
      `SELECT cs.*, u.nombre_completo as cajero_nombre
       FROM caja_sesiones cs
       LEFT JOIN usuarios u ON cs.usuario_id = u.id
       WHERE cs.id = ?`, [req.params.id]
    );

    if (!session) return res.status(404).json({ status: 'error', message: 'Sesión no encontrada' });

    const tickets = queryAll('SELECT numero, total, metodo_pago, created_at FROM pedidos WHERE sesion_id = ? AND pagado = true', [req.params.id]);
    res.json({ status: 'success', sesion: session, tickets });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
