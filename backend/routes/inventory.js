const express = require('express');
const { queryAll, runSql } = require('../config/database');
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

router.get('/', (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const items = queryAll(`SELECT * FROM inventario WHERE 1=1 ${filter.where} ORDER BY id DESC`, filter.params);
    res.json({ status: 'success', data: items });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { ingrediente, cantidad, unidad, stock_minimo, costo_unitario } = req.body;
    if (!ingrediente) return res.status(400).json({ status: 'error', message: 'Nombre del ingrediente requerido' });

    const result = runSql(
      'INSERT INTO inventario (ingrediente, cantidad, unidad, stock_minimo, costo_unitario, sucursal_id) VALUES (?, ?, ?, ?, ?, ?)',
      [ingrediente, cantidad || 0, unidad || 'unidad', stock_minimo || 0, costo_unitario || 0, req.user.sucursal_id]
    );
    res.status(201).json({ status: 'success', message: 'Item creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { cantidad, stock_minimo, costo_unitario, unidad } = req.body;
    runSql(
      'UPDATE inventario SET cantidad=?, stock_minimo=?, costo_unitario=?, unidad=?, updated_at=? WHERE id=?',
      [cantidad, stock_minimo, costo_unitario, unidad, new Date().toISOString(), req.params.id]
    );
    res.json({ status: 'success', message: 'Item actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    runSql('DELETE FROM inventario WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Item eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/low-stock', (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const items = queryAll(`SELECT * FROM inventario WHERE cantidad <= stock_minimo AND stock_minimo > 0 ${filter.where}`, filter.params);
    res.json({ status: 'success', data: items });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
