const express = require('express');
const { queryAll, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const products = queryAll('SELECT * FROM productos_menu ORDER BY id DESC');
    res.json({ status: 'success', data: products });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const cats = queryAll('SELECT DISTINCT categoria FROM productos_menu WHERE categoria IS NOT NULL');
    res.json({ status: 'success', data: cats.map(c => c.categoria) });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nombre, precio, categoria, emoji, prep_duration, descripcion } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ status: 'error', message: 'Nombre y precio son requeridos' });
    }
    const result = runSql(
      'INSERT INTO productos_menu (nombre, descripcion, precio, categoria, emoji, prep_duration, disponible) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [nombre, descripcion || '', precio, categoria || 'Otros', emoji || '', prep_duration || 15]
    );
    res.status(201).json({ status: 'success', message: 'Producto creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, precio, categoria, emoji, prep_duration, disponible } = req.body;
    runSql(
      'UPDATE productos_menu SET nombre=?, precio=?, categoria=?, emoji=?, prep_duration=?, disponible=? WHERE id=?',
      [nombre, precio, categoria, emoji, prep_duration, disponible ? 1 : 0, req.params.id]
    );
    res.json({ status: 'success', message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    runSql('DELETE FROM productos_menu WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
