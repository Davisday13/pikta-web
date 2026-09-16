const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { queryAll, runSql } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'pikta_products', public_id: `product_${Date.now()}` },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

router.get('/', async (req, res) => {
  try {
    const { sucursal_id } = req.query;
    let products;
    if (sucursal_id) {
      products = await queryAll('SELECT * FROM productos_menu WHERE sucursal_id = ? ORDER BY id DESC', [sucursal_id]);
    } else {
      products = await queryAll('SELECT * FROM productos_menu ORDER BY id DESC');
    }
    res.json({ status: 'success', data: products });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const cats = await queryAll('SELECT DISTINCT categoria FROM productos_menu WHERE categoria IS NOT NULL');
    res.json({ status: 'success', data: cats.map(c => c.categoria) });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, precio, categoria, emoji, prep_duration, descripcion, sucursal_id, tipo } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ status: 'error', message: 'Nombre y precio son requeridos' });
    }
    const result = await runSql(
      'INSERT INTO productos_menu (nombre, descripcion, precio, categoria, emoji, prep_duration, disponible, sucursal_id, tipo) VALUES (?, ?, ?, ?, ?, ?, true, ?, ?)',
      [nombre, descripcion || '', precio, categoria || 'Otros', emoji || '', prep_duration || 15, sucursal_id || req.user?.sucursal_id || 1, tipo || 'COMIDA']
    );
    res.status(201).json({ status: 'success', message: 'Producto creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, precio, categoria, emoji, prep_duration, disponible, descripcion, sucursal_id, tipo } = req.body;
    const existing = await queryAll('SELECT disponible FROM productos_menu WHERE id = ?', [req.params.id]);
    const currentDisponible = existing.length ? existing[0].disponible : true;
    const newDisponible = disponible !== undefined ? (disponible ? true : false) : currentDisponible;
    await runSql(
      'UPDATE productos_menu SET nombre=?, precio=?, categoria=?, emoji=?, prep_duration=?, disponible=?, descripcion=?, sucursal_id=?, tipo=? WHERE id=?',
      [nombre, precio, categoria || 'Otros', emoji || '', prep_duration || 15, newDisponible, descripcion || '', sucursal_id || 1, tipo || 'COMIDA', req.params.id]
    );
    res.json({ status: 'success', message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/:id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se envió imagen' });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ status: 'error', message: 'Cloudinary no configurado. Agregue CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en Render.' });
    }

    const imageUrl = await uploadToCloudinary(req.file);
    await runSql('UPDATE productos_menu SET imagen_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    res.json({ status: 'success', message: 'Imagen subida', imagen_url: imageUrl });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Error al subir imagen: ' + err.message });
  }
});

router.delete('/:id/image', async (req, res) => {
  try {
    await runSql('UPDATE productos_menu SET imagen_url = NULL WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Imagen eliminada' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM productos_menu WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
