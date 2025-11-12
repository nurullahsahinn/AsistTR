/**
 * XSS Sanitization Middleware
 * Kullanıcı girdilerini temizler ve XSS saldırılarını önler
 */

const logger = require('../utils/logger');

// HTML karakterlerini escape et
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Object'i recursive olarak temizle
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// XSS sanitization middleware
function xssSanitize(req, res, next) {
  try {
    // Body'yi temizle
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Query parametrelerini temizle
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Params'ı temizle
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('XSS sanitization error:', error);
    next(); // Hata olsa bile devam et
  }
}

module.exports = {
  xssSanitize,
  escapeHtml,
  sanitizeObject
};

