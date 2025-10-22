/**
 * Socket.IO Event Handler
 * Gerçek zamanlı mesajlaşma için WebSocket yönetimi
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Aktif bağlantıları sakla
const activeConnections = new Map();

function socketHandler(io, socket) {
  logger.info(`Yeni socket bağlantısı: ${socket.id}`);
  
  // Ziyaretçi bağlandı
  socket.on('visitor:connect', async (data) => {
    try {
      const { siteId, sessionId, visitorInfo } = data;
      
      // Ziyaretçi kaydı oluştur veya getir
      let visitor = await query(
        'SELECT id FROM visitors WHERE site_id = $1 AND session_id = $2',
        [siteId, sessionId]
      );
      
      let visitorId;
      
      if (visitor.rows.length === 0) {
        // Yeni ziyaretçi oluştur
        const newVisitor = await query(
          `INSERT INTO visitors (site_id, session_id, name, email, ip_address, user_agent, meta)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            siteId,
            sessionId,
            visitorInfo?.name || 'Misafir',
            visitorInfo?.email || null,
            socket.handshake.address,
            socket.handshake.headers['user-agent'],
            JSON.stringify(visitorInfo || {})
          ]
        );
        visitorId = newVisitor.rows[0].id;
      } else {
        visitorId = visitor.rows[0].id;
      }
      
      // Konuşma oluştur
      const conversation = await query(
        `INSERT INTO conversations (site_id, visitor_id, status)
         VALUES ($1, $2, 'open')
         RETURNING id`,
        [siteId, visitorId]
      );
      
      const conversationId = conversation.rows[0].id;
      
      // Socket'i odaya ekle
      socket.join(`conversation:${conversationId}`);
      socket.join(`site:${siteId}`);
      
      // Bağlantı bilgisini sakla
      activeConnections.set(socket.id, {
        type: 'visitor',
        siteId,
        visitorId,
        conversationId
      });
      
      socket.emit('visitor:connected', { 
        conversationId,
        visitorId 
      });
      
      // Agent'lara yeni konuşma bildirimi gönder
      io.to(`site:${siteId}:agents`).emit('conversation:new', {
        conversationId,
        visitor: {
          id: visitorId,
          name: visitorInfo?.name || 'Misafir'
        }
      });
      
      logger.info(`Ziyaretçi bağlandı - Conversation: ${conversationId}`);
      
    } catch (error) {
      logger.error('Visitor connect hatası:', error);
      socket.emit('error', { message: 'Bağlantı hatası' });
    }
  });
  
  // Agent bağlandı
  socket.on('agent:connect', async (data) => {
    try {
      const { agentId, siteId } = data;
      
      socket.join(`site:${siteId}:agents`);
      
      activeConnections.set(socket.id, {
        type: 'agent',
        agentId,
        siteId
      });
      
      // Agent presence güncelle
      await query(
        `INSERT INTO agents_presence (agent_id, socket_id, status, last_seen)
         VALUES ($1, $2, 'online', NOW())
         ON CONFLICT (agent_id) 
         DO UPDATE SET socket_id = $2, status = 'online', last_seen = NOW()`,
        [agentId, socket.id]
      );
      
      socket.emit('agent:connected', { agentId });
      
      logger.info(`Agent bağlandı: ${agentId}`);
      
    } catch (error) {
      logger.error('Agent connect hatası:', error);
    }
  });
  
  // Yeni mesaj
  socket.on('message:send', async (data) => {
    try {
      const { conversationId, body, senderType } = data;
      const connection = activeConnections.get(socket.id);
      
      if (!connection) {
        return socket.emit('error', { message: 'Geçersiz bağlantı' });
      }
      
      // Mesajı veritabanına kaydet
      const result = await query(
        `INSERT INTO messages (conversation_id, sender_type, sender_id, body, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [
          conversationId,
          senderType,
          connection.agentId || connection.visitorId,
          body
        ]
      );
      
      const message = result.rows[0];
      
      // Odadaki herkese mesajı gönder
      io.to(`conversation:${conversationId}`).emit('message:received', {
        id: message.id,
        conversationId,
        senderType: message.sender_type,
        body: message.body,
        createdAt: message.created_at
      });
      
      logger.info(`Mesaj gönderildi - Conversation: ${conversationId}`);
      
    } catch (error) {
      logger.error('Message send hatası:', error);
      socket.emit('error', { message: 'Mesaj gönderilemedi' });
    }
  });
  
  // Agent yazıyor bildirimi
  socket.on('typing:start', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('typing:agent');
  });
  
  socket.on('typing:stop', (data) => {
    const { conversationId } = data;
    socket.to(`conversation:${conversationId}`).emit('typing:stop');
  });
  
  // Bağlantı koptuğunda
  socket.on('disconnect', async () => {
    try {
      const connection = activeConnections.get(socket.id);
      
      if (connection?.type === 'agent') {
        // Agent offline yap
        await query(
          `UPDATE agents_presence 
           SET status = 'offline', last_seen = NOW()
           WHERE socket_id = $1`,
          [socket.id]
        );
        
        logger.info(`Agent bağlantısı kesildi: ${connection.agentId}`);
      }
      
      activeConnections.delete(socket.id);
      logger.info(`Socket bağlantısı kesildi: ${socket.id}`);
      
    } catch (error) {
      logger.error('Disconnect hatası:', error);
    }
  });
}

module.exports = socketHandler;

