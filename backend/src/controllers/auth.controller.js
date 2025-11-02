/**
 * Authentication Controller
 * Kullanıcı kaydı, girişi ve yetkilendirme işlemleri
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

// JWT token oluştur
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      site_id: user.site_id // site_id'yi token'a ekle
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Kullanıcı kaydı
async function register(req, res) {
  try {
    const { name, email, password, role = 'agent' } = req.body;

    // E-posta kontrolü
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

    // Kullanıcı oluştur
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role, site_id, created_at`,
      [name, email, passwordHash, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    logger.info(`Yeni kullanıcı kaydı: ${email}`);

    res.status(201).json({
      message: 'Kayıt başarılı',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        site_id: user.site_id
      },
      token
    });

  } catch (error) {
    logger.error('Register hatası:', error);
    res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu' });
  }
}

// Kullanıcı girişi
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Kullanıcıyı bul
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const user = result.rows[0];

    // Şifre kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const token = generateToken(user);

    logger.info(`Kullanıcı girişi: ${email}`);

    res.json({
      message: 'Giriş başarılı',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        site_id: user.site_id, // site_id'yi yanıta ekle
        avatar_url: user.avatar_url
      },
      token
    });

  } catch (error) {
    logger.error('Login hatası:', error);
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu' });
  }
}

// Kullanıcı bilgilerini getir
async function getMe(req, res) {
  try {
    const result = await query(
      'SELECT id, name, email, role, site_id, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    logger.error('GetMe hatası:', error);
    res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
  }
}

module.exports = {
  register,
  login,
  getMe
};



