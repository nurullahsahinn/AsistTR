/**
 * Rate Limiting Middleware
 * API isteklerini sınırlar
 */

const rateLimit = require('express-rate-limit');

// Genel API rate limit
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 dakika
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 istek
  message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoint'leri için daha sıkı limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // 5 istek
  message: 'Çok fazla giriş denemesi, lütfen 15 dakika sonra tekrar deneyin',
  skipSuccessfulRequests: true,
});

// Widget için daha gevşek limit
const widgetLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 20, // 20 istek
  message: 'Çok fazla mesaj gönderdiniz, lütfen biraz bekleyin',
});

module.exports = {
  apiLimiter,
  authLimiter,
  widgetLimiter
};




