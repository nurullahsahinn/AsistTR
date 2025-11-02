/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const { loginValidation, registerValidation } = require('../middleware/validator.middleware');
const { authMiddleware } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');

// Kayıt
router.post('/register', authLimiter, registerValidation, register);

// Giriş
router.post('/login', authLimiter, loginValidation, login);

// Kullanıcı bilgisi (korumalı route)
router.get('/me', authMiddleware, getMe);

module.exports = router;




