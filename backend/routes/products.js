const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { queryAll, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

router.get('/', (req, res) => {
  try {
    const { sucursal_id } = req.query;
    let products;
    if (sucursal_id) {
      products = queryAll('SELECT * FROM productos_menu WHERE sucursal_id = ? ORDER BY id DESC', [sucursal_id]);
    } else {
      products = queryAll('SELECT * FROM productos_menu ORDER BY id DESC');
    }
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
    const { nombre, precio, categoria, emoji, prep_duration, descripcion, sucursal_id } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ status: 'error', message: 'Nombre y precio son requeridos' });
    }
    const result = runSql(
      'INSERT INTO productos_menu (nombre, descripcion, precio, categoria, emoji, prep_duration, disponible, sucursal_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [nombre, descripcion || '', precio, categoria || 'Otros', emoji || '', prep_duration || 15, sucursal_id || req.user?.sucursal_id || 1]
    );
    res.status(201).json({ status: 'success', message: 'Producto creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { nombre, precio, categoria, emoji, prep_duration, disponible, descripcion, sucursal_id } = req.body;
    const existing = queryAll('SELECT disponible FROM productos_menu WHERE id = ?', [req.params.id]);
    const currentDisponible = existing.length ? existing[0].disponible : 1;
    const newDisponible = disponible !== undefined ? (disponible ? 1 : 0) : currentDisponible;
    runSql(
      'UPDATE productos_menu SET nombre=?, precio=?, categoria=?, emoji=?, prep_duration=?, disponible=?, descripcion=?, sucursal_id=? WHERE id=?',
      [nombre, precio, categoria || 'Otros', emoji || '', prep_duration || 15, newDisponible, descripcion || '', sucursal_id || 1, req.params.id]
    );
    res.json({ status: 'success', message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se envió imagen' });
    }
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    runSql('UPDATE productos_menu SET imagen_url = ? WHERE id = ?', [base64, req.params.id]);
    res.json({ status: 'success', message: 'Imagen subida', imagen_url: base64 });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id/image', (req, res) => {
  try {
    runSql('UPDATE productos_menu SET imagen_url = NULL WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Imagen eliminada' });
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
