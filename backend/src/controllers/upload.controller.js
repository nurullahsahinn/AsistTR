/**
 * Upload Controller
 * Dosya yükleme işlemleri
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Dosya yükle
 */
async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya bulunamadı' });
    }

    const file = {
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    };

    logger.info(`Dosya yüklendi: ${file.name} (${file.size} bytes)`);

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
