const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, runSql, getSucursales } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

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

router.get('/sucursales', async (req, res) => {
  try {
    const sucursales = await getSucursales();
    res.json({ status: 'success', data: sucursales });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = buildSucursalFilter(req);
    const users = await queryAll(`SELECT id, username, rol, nombre_completo, sucursal_id FROM usuarios WHERE 1=1 ${filter.where}`, filter.params);
    res.json({ status: 'success', data: users });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, password, rol, nombre_completo, sucursal_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Usuario y contraseña requeridos' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const result = await runSql(
      'INSERT INTO usuarios (username, password, rol, nombre_completo, sucursal_id) VALUES (?, ?, ?, ?, ?)',
      [username, hashed, rol || 'Mesero', nombre_completo || username, sucursal_id || 1]
    );
    res.status(201).json({ status: 'success', message: 'Usuario creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { rol, nombre_completo, password, sucursal_id } = req.body;

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      await runSql('UPDATE usuarios SET rol=?, nombre_completo=?, password=?, sucursal_id=? WHERE id=?',
        [rol, nombre_completo, hashed, sucursal_id, req.params.id]);
    } else {
      await runSql('UPDATE usuarios SET rol=?, nombre_completo=?, sucursal_id=? WHERE id=?',
        [rol, nombre_completo, sucursal_id, req.params.id]);
    }
    res.json({ status: 'success', message: 'Usuario actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await runSql('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
