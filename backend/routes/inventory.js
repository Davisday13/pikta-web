const express = require('express');
const { queryAll, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const items = queryAll('SELECT * FROM inventario ORDER BY id DESC');
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
      'INSERT INTO inventario (ingrediente, cantidad, unidad, stock_minimo, costo_unitario) VALUES (?, ?, ?, ?, ?)',
      [ingrediente, cantidad || 0, unidad || 'unidad', stock_minimo || 0, costo_unitario || 0]
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
    const items = queryAll('SELECT * FROM inventario WHERE cantidad <= stock_minimo AND stock_minimo > 0');
    res.json({ status: 'success', data: items });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
