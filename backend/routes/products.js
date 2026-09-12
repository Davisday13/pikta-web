const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { queryAll, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const IMAGES_DIR = path.join(__dirname, '..', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

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

router.post('/:id/image', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ status: 'error', message: 'La imagen no puede superar 5MB' });
      }
      return res.status(400).json({ status: 'error', message: 'Formato no permitido' });
    }
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se envió imagen' });
    }

    const imagen_url = req.file.filename;
    runSql('UPDATE productos_menu SET imagen_url = ? WHERE id = ?', [imagen_url, req.params.id]);
    res.json({ status: 'success', message: 'Imagen subida', imagen_url });
  });
});

router.delete('/:id/image', (req, res) => {
  try {
    const product = queryAll('SELECT imagen_url FROM productos_menu WHERE id = ?', [req.params.id]);
    if (product.length && product[0].imagen_url) {
      const filepath = path.join(IMAGES_DIR, product[0].imagen_url);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      runSql('UPDATE productos_menu SET imagen_url = NULL WHERE id = ?', [req.params.id]);
    }
    res.json({ status: 'success', message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const product = queryAll('SELECT imagen_url FROM productos_menu WHERE id = ?', [req.params.id]);
    if (product.length && product[0].imagen_url) {
      const filepath = path.join(IMAGES_DIR, product[0].imagen_url);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    runSql('DELETE FROM productos_menu WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
