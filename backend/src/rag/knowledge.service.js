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
      // Embedding olmadan kaydet
      const result = await query(
        `INSERT INTO knowledge_base (site_id, title, content, metadata, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [siteId, title, content, JSON.stringify(metadata)]
      );
      logger.info(`Bilgi tabanına eklendi (embedding olmadan): ${title}`);
      return result.rows[0];
    }
    
    // Embedding ile kaydet
    const result = await query(
      `INSERT INTO knowledge_base (site_id, title, content, embedding, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [siteId, title, content, JSON.stringify(embedding), JSON.stringify(metadata)]
    );
    
    logger.info(`Bilgi tabanına eklendi (embedding ile): ${title}`);
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
 * İlgili bilgileri ara (hybrid search: text + vector birleşik)
 */
async function searchKnowledge(siteId, searchQuery, limit = 3) {
  try {
    logger.info(`Arama başlatılıyor: "${searchQuery}"`);
    
    // 1. Text-based search yap
    const textResults = await textBasedSearch(siteId, searchQuery, limit);
    logger.info(`Text search: ${textResults.length} sonuç`);
    
    // 2. Vector search yap (eğer embedding oluşturulabilirse)
    let vectorResults = [];
    const queryEmbedding = await generateEmbedding(searchQuery);
    
    if (queryEmbedding) {
      const result = await query(
        `SELECT 
           id, 
           title, 
           content, 
           metadata,
           1 - (embedding <=> $1::vector) as similarity
         FROM knowledge_base
         WHERE site_id = $2 
         AND is_active = true
         AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [JSON.stringify(queryEmbedding), siteId, limit]
      );
      vectorResults = result.rows;
      logger.info(`Vector search: ${vectorResults.length} sonuç`);
    } else {
      logger.warn('Embedding oluşturulamadı, sadece text search kullanılıyor');
    }
    
    // 3. Sonuçları birleştir (text öncelikli, sonra vector)
    if (textResults.length > 0) {
      // Text search sonuç bulduysa bunu kullan (çünkü Türkçe için daha güvenilir)
      logger.info(`Text search ile ${textResults.length} sonuç döndürülüyor`);
      return textResults;
    }
    
    if (vectorResults.length > 0) {
      // Text bulamadıysa vector kullan
      logger.info(`Vector search ile ${vectorResults.length} sonuç döndürülüyor`);
      return vectorResults;
    }
    
    // Hiçbir sonuç yok
    logger.warn('Hiçbir sonuç bulunamadı');
    return [];
    
  } catch (error) {
    logger.error('SearchKnowledge hatası:', error);
    return [];
  }
}

/**
 * Text-based search (Türkçe için optimize edilmiş)
 */
async function textBasedSearch(siteId, searchQuery, limit = 3) {
  try {
    // Anahtar kelimeleri çıkart
    const keywords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2); // 2 karakterden uzun kelimeler
    
    if (keywords.length === 0) {
      return [];
    }
    
    // Her kelime için ILIKE pattern oluştur
    const patterns = keywords.map(k => `%${k}%`);
    
    // Çoklu kelime arama - herhangi biri eşleşirse
    const whereConditions = keywords.map((_, idx) => 
      `(title ILIKE $${idx + 3} OR content ILIKE $${idx + 3})`
    ).join(' OR ');
    
    // Skor hesaplama: Her kelime eşleşmesi için puan
    const scoreCalculations = keywords.map((_, idx) => {
      return `
        CASE WHEN title ILIKE $${idx + 3} THEN 10 ELSE 0 END +
        CASE WHEN content ILIKE $${idx + 3} THEN 3 ELSE 0 END
      `;
    }).join(' + ');
    
    const sql = `
      SELECT id, title, content, metadata,
        (${scoreCalculations}) as relevance_score
      FROM knowledge_base
      WHERE site_id = $1 
        AND is_active = true
        AND (${whereConditions})
      ORDER BY relevance_score DESC, created_at DESC
      LIMIT $2
    `;
    
    const params = [siteId, limit, ...patterns];
    const result = await query(sql, params);
    
    logger.info(`Text search sonuç: ${result.rows.length} eşleşme bulundu`);
    return result.rows;
    
  } catch (error) {
    logger.error('TextBasedSearch hatası:', error);
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

