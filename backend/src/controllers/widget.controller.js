/**
 * Widget Controller
 * Widget ayarları ve ziyaretçi yönetimi
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Widget ayarlarını getir (public - auth gerekmez)
async function getWidgetSettings(req, res) {
  try {
    const { apiKey } = req.params;
    
    const result = await query(
      `SELECT 
        w.id,
        w.settings,
        s.name as site_name,
        s.domain
       FROM sites w
       LEFT JOIN sites s ON w.id = s.id
       WHERE w.api_key = $1 AND w.is_active = true`,
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Widget bulunamadı' });
    }
    
    res.json({ 
      widget: result.rows[0],
      settings: result.rows[0].settings || {}
    });
    
  } catch (error) {
    logger.error('GetWidgetSettings hatası:', error);
    res.status(500).json({ error: 'Widget ayarları alınamadı' });
  }
}

// Yeni site/widget oluştur
async function createSite(req, res) {
  try {
    const { name, domain, settings = {} } = req.body;
    const ownerId = req.user.id;
    
    // API key oluştur
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    const result = await query(
      `INSERT INTO sites (owner_id, name, domain, settings, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ownerId, name, domain, JSON.stringify(settings), apiKey]
    );
    
    logger.info(`Yeni site oluşturuldu: ${name}`);
    
    res.status(201).json({ 
      message: 'Site oluşturuldu',
      site: result.rows[0]
    });
    
  } catch (error) {
    logger.error('CreateSite hatası:', error);
    res.status(500).json({ error: 'Site oluşturulamadı' });
  }
}

// Kullanıcının sitelerini listele
async function getSites(req, res) {
  try {
    const result = await query(
      `SELECT * FROM sites WHERE owner_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    res.json({ sites: result.rows });
    
  } catch (error) {
    logger.error('GetSites hatası:', error);
    res.status(500).json({ error: 'Siteler alınamadı' });
  }
}

// Widget ayarlarını güncelle
async function updateSiteSettings(req, res) {
  try {
    const { siteId } = req.params;
    const { settings } = req.body;
    
    // Kullanıcının bu site'a erişimi var mı kontrol et
    const checkResult = await query(
      'SELECT id FROM sites WHERE id = $1 AND owner_id = $2',
      [siteId, req.user.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'Bu site için yetkiniz yok' });
    }
    
    await query(
      'UPDATE sites SET settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(settings), siteId]
    );
    
    res.json({ message: 'Ayarlar güncellendi' });
    
  } catch (error) {
    logger.error('UpdateSiteSettings hatası:', error);
    res.status(500).json({ error: 'Ayarlar güncellenemedi' });
  }
}

module.exports = {
  getWidgetSettings,
  createSite,
  getSites,
  updateSiteSettings
};




