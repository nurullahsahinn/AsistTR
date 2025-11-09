/**
 * Authentication Middleware
 * JWT token kontrolü yapar
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function authMiddleware(req, res, next) {
  try {
    // Token'ı header'dan al
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token bulunamadı' });
    }

    const token = authHeader.split(' ')[1];

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcı bilgilerini request'e ekle
    req.user = decoded;
    next();

  } catch (error) {
    logger.error('Auth middleware hatası:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token süresi dolmuş' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Geçersiz token' });
    }
    
    return res.status(500).json({ error: 'Kimlik doğrulama hatası' });
  }
}

// Sadece admin yetkisi olanların geçebileceği middleware
function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
}

// Belirli rollerin geçebileceği middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    }
    
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
  };
}

module.exports = {
  authenticate: authMiddleware,
  authMiddleware,
  adminOnly,
  requireRole
};



