/**
 * Upload Controller
 * Dosya yükleme işlemleri
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Dosya yükle (güvenlik kontrolleri ile)
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya bulunamadı' });
    }

    // Güvenlik kontrolleri
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      // Dosyayı sil
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: 'Dosya boyutu çok büyük! Maksimum 10MB.' });
    }

    // Dosya adını sanitize et (XSS koruması)
    const sanitizeFilename = (filename) => {
      return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Sadece alfanumerik, nokta, alt çizgi ve tire
        .substring(0, 255); // Maksimum uzunluk
    };

    const sanitizedName = sanitizeFilename(req.file.originalname);

    // MIME type kontrolü (ek güvenlik)
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip', 'application/x-rar-compressed'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: 'Geçersiz dosya tipi!' });
    }

    const file = {
      url: `/uploads/${req.file.filename}`,
      name: sanitizedName,
      type: req.file.mimetype,
      size: req.file.size
    };

    logger.info(`Dosya yüklendi: ${file.name} (${file.size} bytes, ${file.type})`);

    res.json({ file });

  } catch (error) {
    logger.error('Upload hatası:', error);
    res.status(500).json({ error: 'Dosya yüklenemedi' });
  }
}

/**
 * Dosyayı sil
 */
async function deleteFile(req, res) {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Dosya silindi: ${filename}`);
      res.json({ message: 'Dosya silindi' });
    } else {
      res.status(404).json({ error: 'Dosya bulunamadı' });
    }

  } catch (error) {
    logger.error('Dosya silme hatası:', error);
    res.status(500).json({ error: 'Dosya silinemedi' });
  }
}

module.exports = {
  uploadFile,
  deleteFile
};
