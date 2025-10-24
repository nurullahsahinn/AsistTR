/**
 * Chat Controller
 * Sohbet ve mesaj yönetimi
 */

const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');

// Tüm konuşmaları listele (agent için)
async function getConversations(req, res) {
  try {
    const { siteId, status = 'open' } = req.query;
    
    let sql = `
      SELECT 
        c.id,
        c.status,
        c.created_at,
        v.name as visitor_name,
        v.email as visitor_email,
        s.name as site_name,
        (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      LEFT JOIN visitors v ON c.visitor_id = v.id
      LEFT JOIN sites s ON c.site_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (siteId) {
      sql += ` AND c.site_id = $${paramCount}`;
      params.push(siteId);
      paramCount++;
    }
    
    if (status) {
      sql += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    sql += ' ORDER BY c.created_at DESC LIMIT 50';
    
    const result = await query(sql, params);
    
    res.json({ conversations: result.rows });
    
  } catch (error) {
    logger.error('GetConversations hatası:', error);
    res.status(500).json({ error: 'Konuşmalar alınamadı' });
  }
}

// Belirli bir konuşmanın mesajlarını getir
async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(
      `SELECT 
        m.id,
        m.sender_type,
        m.body,
        m.attachments,
        m.is_read,
        m.created_at
       FROM messages m
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    
    res.json({ messages: result.rows });
    
  } catch (error) {
    logger.error('GetMessages hatası:', error);
    res.status(500).json({ error: 'Mesajlar alınamadı' });
  }
}

// Konuşmayı kapat
async function closeConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const { rating } = req.body;
    
    await query(
      `UPDATE conversations 
       SET status = 'closed', closed_at = NOW(), rating = $1
       WHERE id = $2`,
      [rating || null, conversationId]
    );
    
    logger.info(`Konuşma kapatıldı: ${conversationId}`);
    
    res.json({ message: 'Konuşma kapatıldı' });
    
  } catch (error) {
    logger.error('CloseConversation hatası:', error);
    res.status(500).json({ error: 'Konuşma kapatılamadı' });
  }
}

// Konuşmaya agent ata
async function assignAgent(req, res) {
  try {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    
    await query(
      'UPDATE conversations SET agent_id = $1 WHERE id = $2',
      [agentId, conversationId]
    );
    
    res.json({ message: 'Agent atandı' });
    
  } catch (error) {
    logger.error('AssignAgent hatası:', error);
    res.status(500).json({ error: 'Agent atanamadı' });
  }
}

module.exports = {
  getConversations,
  getMessages,
  closeConversation,
  assignAgent
};


