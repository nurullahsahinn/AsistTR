/**
 * Chat Controller
 * Sohbet ve mesaj yönetimi
 */

const { query, transaction, pool } = require('../utils/database');
const logger = require('../utils/logger');
const { unassignAgent, transferConversation } = require('../services/routing.service');

// io objesini global değişkenden al
function getIO() {
  return global.socketIO;
}

// Tüm konuşmaları listele (agent için)
async function getConversations(req, res) {
  try {
    const { siteId, status = 'open' } = req.query;
    
    let sql = `
      SELECT 
        c.id,
        c.status,
        c.created_at,
        c.agent_id,
        agent.name as agent_name,
        v.name as visitor_name,
        v.email as visitor_email,
        s.name as site_name,
        (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      LEFT JOIN visitors v ON c.visitor_id = v.id
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN users agent ON c.agent_id = agent.id
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
    
    // ✅ En son mesaj gelen conversation en üstte
    // ORDER BY'da subquery'yi tekrar yazıyoruz (PostgreSQL alias kullanamıyor)
    sql += ' ORDER BY COALESCE((SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), c.created_at) DESC LIMIT 50';
    
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
    
    const result = await query(
      `UPDATE conversations 
       SET status = 'closed', closed_at = NOW(), rating = $1
       WHERE id = $2
       RETURNING site_id, agent_id`,
      [rating || null, conversationId]
    );

    if (result.rows.length > 0) {
      const { site_id, agent_id } = result.rows[0];
      
      // Unassign agent (decrease chat count)
      if (agent_id) {
        await unassignAgent(conversationId, agent_id);
      }
      
      // Agent'lara ve visitor'a sohbetin kapandığını bildir
      const io = getIO();
      io.to(`site:${site_id}:agents`).emit('conversation:closed', { conversationId });
      io.to(`conv:${conversationId}`).emit('conversation:ended', { conversationId });
      logger.info(`Konuşma kapatıldı ve bildirildi: ${conversationId}`);
    } else {
      logger.warn(`Kapatılacak konuşma bulunamadı: ${conversationId}`);
    }
    
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
    const { agentId } = req.body; // Atanacak agent'ın ID'si
    const requestingAgentName = req.user.name; // Atamayı yapan agent'ın adı
    
    // Get current agent to handle transfer
    const convResult = await query(
      'SELECT agent_id, site_id FROM conversations WHERE id = $1',
      [conversationId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Konuşma bulunamadı' });
    }
    
    const { agent_id: currentAgentId, site_id } = convResult.rows[0];
    
    // Use routing service for transfer
    try {
      await transferConversation(conversationId, currentAgentId, agentId);
      
      // Agent'lara sohbetin atandığını bildir
      const io = getIO();
      io.to(`site:${site_id}:agents`).emit('conversation:assigned', {
        conversationId,
        agentId,
        agentName: requestingAgentName
      });
      
      logger.info(`Konuşma ${conversationId}, agent ${agentId}'e atandı.`);
      res.json({ message: 'Agent atandı' });
      
    } catch (transferError) {
      return res.status(400).json({ error: transferError.message });
    }
    
  } catch (error) {
    logger.error('AssignAgent hatası:', error);
    res.status(500).json({ error: 'Agent atanamadı' });
  }
}

// Konuşmayı sil (Sadece Admin)
async function deleteConversation(req, res) {
  const { conversationId } = req.params;
  
  try {
    // Transaction içinde silme işlemi yap
    await transaction(async (client) => {
      // Silmeden önce site_id'yi al
      const convResult = await client.query('SELECT site_id FROM conversations WHERE id = $1', [conversationId]);
      if (convResult.rows.length === 0) {
        throw new Error('Konuşma bulunamadı');
      }
      const { site_id } = convResult.rows[0];

      // Önce mesajları sil
      await client.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
      
      // Sonra konuşmayı sil
      await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);

      // Agent'lara sohbetin silindiğini bildir
      const io = getIO();
      io.to(`site:${site_id}:agents`).emit('conversation:deleted', { conversationId });
      
      logger.info(`Konuşma silindi ve bildirildi: ${conversationId}`);
    });

    res.status(200).json({ message: 'Konuşma başarıyla silindi' });

  } catch (error) {
    logger.error('DeleteConversation hatası:', error);
    if (error.message === 'Konuşma bulunamadı') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Konuşma silinemedi' });
  }
}

// Konuşmayı değerlendir (Rating - Public endpoint)
async function rateConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const { rating, feedback } = req.body;
    
    // Rating validation (1-5 yıldız)
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating 1-5 arasında olmalı' });
    }
    
    // Konuşmayı güncelle
    const result = await query(
      `UPDATE conversations 
       SET rating = $1, feedback = $2
       WHERE id = $3
       RETURNING site_id, agent_id`,
      [rating, feedback || null, conversationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Konuşma bulunamadı' });
    }
    
    const { site_id, agent_id } = result.rows[0];
    
    // Agent'a rating bildirimini gönder
    if (agent_id) {
      const io = getIO();
      io.to(`site:${site_id}:agents`).emit('conversation:rated', {
        conversationId,
        agentId: agent_id,
        rating,
        feedback
      });
    }
    
    logger.info(`Konuşma değerlendirildi: ${conversationId}, Rating: ${rating}`);
    res.json({ message: 'Değerlendirme kaydedildi', rating });
    
  } catch (error) {
    logger.error('RateConversation hatası:', error);
    res.status(500).json({ error: 'Değerlendirme kaydedilemedi' });
  }
}

module.exports = {
  getConversations,
  getMessages,
  closeConversation,
  assignAgent,
  deleteConversation,
  rateConversation
};



