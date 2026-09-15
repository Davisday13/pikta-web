const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, getSucursales } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pikta_web_secret_key_2026';
const JWT_EXPIRES = '24h';

router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Usuario y contraseña requeridos' });
    }

    const user = await queryOne('SELECT * FROM usuarios WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ status: 'error', message: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { user_id: user.id, username: user.username, rol: user.rol, nombre_completo: user.nombre_completo, sucursal_id: user.sucursal_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const { password: _, ...userData } = user;
    res.json({ status: 'success', token, user: userData });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
});

router.get('/me', require('../middleware/auth').authMiddleware, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, username, rol, nombre_completo, sucursal_id FROM usuarios WHERE id = ?', [req.user.user_id]);
    if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    res.json({ status: 'success', user });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/sucursales', async (req, res) => {
  try {
    const sucursales = await getSucursales();
    res.json({ status: 'success', data: sucursales });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
