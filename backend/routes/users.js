const express = require('express');
const bcrypt = require('bcryptjs');
const { queryAll, runSql } = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  try {
    const users = queryAll('SELECT id, username, rol, nombre_completo FROM usuarios');
    res.json({ status: 'success', data: users });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/', adminOnly, (req, res) => {
  try {
    const { username, password, rol, nombre_completo } = req.body;
    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Usuario y contraseña requeridos' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const result = runSql(
      'INSERT INTO usuarios (username, password, rol, nombre_completo) VALUES (?, ?, ?, ?)',
      [username, hashed, rol || 'Mesero', nombre_completo || username]
    );
    res.status(201).json({ status: 'success', message: 'Usuario creado', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.put('/:id', adminOnly, (req, res) => {
  try {
    const { rol, nombre_completo, password } = req.body;

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      runSql('UPDATE usuarios SET rol=?, nombre_completo=?, password=? WHERE id=?',
        [rol, nombre_completo, hashed, req.params.id]);
    } else {
      runSql('UPDATE usuarios SET rol=?, nombre_completo=? WHERE id=?',
        [rol, nombre_completo, req.params.id]);
    }
    res.json({ status: 'success', message: 'Usuario actualizado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.delete('/:id', adminOnly, (req, res) => {
  try {
    runSql('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ status: 'success', message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
