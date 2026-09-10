const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pikta_web_secret_key_2026';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Token inválido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.rol !== 'Administrador' && req.user.rol !== 'Supervisor') {
    return res.status(403).json({ status: 'error', message: 'Acceso denegado: se requiere rol Administrador o Supervisor' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
