/**
 * Knowledge Base Service
 * Bilgi tabanı yönetimi ve RAG (Retrieval-Augmented Generation) işlemleri
 */

const { query } = require('../utils/database');
const { generateEmbedding } = require('./ollama.service');
const logger = require('../utils/logger');

/**
 * Bilgi tabanına yeni içerik ekle
 */
async function addKnowledge(siteId, title, content, metadata = {}) {
  try {
    // Embedding oluştur
    const embedding = await generateEmbedding(content);
    
    if (!embedding) {
      logger.warn('Embedding oluşturulamadı, sadece metin kaydediliyor');
    }
    
    const result = await query(
      `INSERT INTO knowledge_base (site_id, title, content, metadata, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [siteId, title, content, JSON.stringify(metadata)]
    );
    
    logger.info(`Bilgi tabanına eklendi: ${title}`);
    return result.rows[0];
    
  } catch (error) {
    logger.error('AddKnowledge hatası:', error);
    throw error;
  }
}

/**
 * Siteye ait bilgileri listele
 */
async function getKnowledgeList(siteId) {
  try {
    const result = await query(
      `SELECT id, title, content, metadata, is_active, created_at, updated_at
       FROM knowledge_base
       WHERE site_id = $1
       ORDER BY created_at DESC`,
      [siteId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('GetKnowledgeList hatası:', error);
    throw error;
  }
}

/**
 * Belirli bir bilgiyi getir
 */
async function getKnowledge(id) {
  try {
    const result = await query(
      'SELECT * FROM knowledge_base WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('GetKnowledge hatası:', error);
    throw error;
  }
}

/**
 * İlgili bilgileri ara (basit metin araması)
 * Not: Gelişmiş vector search için pgvector extension gerekir
 */
async function searchKnowledge(siteId, searchQuery, limit = 3) {
  try {
    // Basit metin araması (ILIKE ile)
    const result = await query(
      `SELECT id, title, content, metadata
       FROM knowledge_base
       WHERE site_id = $1 
       AND is_active = true
       AND (
         title ILIKE $2 
         OR content ILIKE $2
       )
       ORDER BY 
         CASE 
           WHEN title ILIKE $2 THEN 1
           ELSE 2
         END,
         created_at DESC
       LIMIT $3`,
      [siteId, `%${searchQuery}%`, limit]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('SearchKnowledge hatası:', error);
    return [];
  }
}

/**
 * Bilgiyi güncelle
 */
async function updateKnowledge(id, updates) {
  try {
    const { title, content, metadata, isActive } = updates;
    
    let setClauses = [];
    let values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      setClauses.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    
    if (content !== undefined) {
      setClauses.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
      
      // İçerik değiştiyse yeni embedding oluştur
      const embedding = await generateEmbedding(content);
      if (embedding) {
        setClauses.push(`embedding = $${paramCount}`);
        values.push(JSON.stringify(embedding));
        paramCount++;
      }
    }
    
    if (metadata !== undefined) {
      setClauses.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(metadata));
      paramCount++;
    }
    
    if (isActive !== undefined) {
      setClauses.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }
    
    setClauses.push(`updated_at = NOW()`);
    values.push(id);
    
    const sql = `UPDATE knowledge_base SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await query(sql, values);
    return result.rows[0];
    
  } catch (error) {
    logger.error('UpdateKnowledge hatası:', error);
    throw error;
  }
}

/**
 * Bilgiyi sil
 */
async function deleteKnowledge(id) {
  try {
    await query('DELETE FROM knowledge_base WHERE id = $1', [id]);
    logger.info(`Bilgi silindi: ${id}`);
  } catch (error) {
    logger.error('DeleteKnowledge hatası:', error);
    throw error;
  }
}

/**
 * Toplu bilgi ekleme (örnek: FAQ yüklemek için)
 */
async function bulkAddKnowledge(siteId, items) {
  try {
    const results = [];
    
    for (const item of items) {
      const result = await addKnowledge(
        siteId,
        item.title,
        item.content,
        item.metadata || {}
      );
      results.push(result);
    }
    
    logger.info(`Toplu ekleme: ${results.length} kayıt eklendi`);
    return results;
    
  } catch (error) {
    logger.error('BulkAddKnowledge hatası:', error);
    throw error;
  }
}

module.exports = {
  addKnowledge,
  getKnowledgeList,
  getKnowledge,
  searchKnowledge,
  updateKnowledge,
  deleteKnowledge,
  bulkAddKnowledge
};

