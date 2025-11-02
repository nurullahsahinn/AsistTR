/**
 * Validation Middleware
 * Express Validator ile input doğrulama
 */

const { body, param, validationResult } = require('express-validator');

// Validation sonuçlarını kontrol et
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Doğrulama hatası',
      details: errors.array() 
    });
  }
  next();
}

// Login validasyonu
const loginValidation = [
  body('email').isEmail().withMessage('Geçerli bir e-posta adresi girin'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  validate
];

// Register validasyonu
const registerValidation = [
  body('name').trim().isLength({ min: 2 }).withMessage('İsim en az 2 karakter olmalı'),
  body('email').isEmail().withMessage('Geçerli bir e-posta adresi girin'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  validate
];

// Message validasyonu
const messageValidation = [
  body('conversationId').isUUID().withMessage('Geçersiz conversation ID'),
  body('body').trim().isLength({ min: 1, max: 5000 }).withMessage('Mesaj 1-5000 karakter arasında olmalı'),
  validate
];

module.exports = {
  validate,
  loginValidation,
  registerValidation,
  messageValidation
};




