/**
 * Widget Authentication Middleware
 * API key ile widget'dan gelen istekleri doğrular
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

async function widgetAuth(req, res, next) {
  try {
    // API key'i header'dan veya body'den al
    const apiKey = req.headers['x-api-key'] || req.body?.apiKey || req.query?.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key gerekli' });
    }
    
    // API key'i veritabanında kontrol et
    const result = await query(
      'SELECT id, name, is_active FROM sites WHERE api_key = $1',
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz API key' });
    }
    
    const site = result.rows[0];
    
    if (!site.is_active) {
      return res.status(403).json({ error: 'Site aktif değil' });
    }
    
    // Site bilgisini request'e ekle
    req.site = site;
    req.siteId = site.id;
    
    next();
  } catch (error) {
    logger.error('Widget auth hatası:', error);
    res.status(500).json({ error: 'Kimlik doğrulama hatası' });
  }
}

module.exports = { widgetAuth };

