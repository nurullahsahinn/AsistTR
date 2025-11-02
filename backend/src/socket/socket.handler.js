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
  
  // Hata yönetimi
  socket.on('error', (error) => {
    logger.error(`Socket hatası [${socket.id}]:`, error);
  });
  
  // Heartbeat / Ping-Pong
  socket.on('ping', () => {
    socket.emit('pong', Date.now());
  });
  
  // Ziyaretçi bağlandı
  socket.on('visitor:connect', async (data) => {
    try {
      const { apiKey, sessionId, visitorInfo } = data;
      
      logger.info('Visitor connect attempt:', { apiKey, sessionId, visitorInfo });
      
      // API key'den site bilgisini al
      const siteResult = await query(
        'SELECT id FROM sites WHERE api_key = $1',
        [apiKey]
      );
      
      if (siteResult.rows.length === 0) {
        logger.error('Invalid API key:', apiKey);
        socket.emit('error', { message: 'Geçersiz API key' });
        return;
      }
      
      const siteId = siteResult.rows[0].id;
      logger.info('Site found:', siteId);
      
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
        logger.info('New visitor created:', visitorId);
      } else {
        visitorId = visitor.rows[0].id;
        
        // Mevcut ziyaretçinin bilgilerini güncelle (ad değişmiş olabilir)
        await query(
          `UPDATE visitors 
           SET name = $1, email = $2, meta = $3, ip_address = $4, user_agent = $5
           WHERE id = $6`,
          [
            visitorInfo?.name || 'Misafir',
            visitorInfo?.email || null,
            JSON.stringify(visitorInfo || {}),
            socket.handshake.address,
            socket.handshake.headers['user-agent'],
            visitorId
          ]
        );
        
        logger.info('Existing visitor found and updated:', visitorId);
      }
      
      // Konuşma oluştur
      const conversation = await query(
        `INSERT INTO conversations (site_id, visitor_id, status)
         VALUES ($1, $2, 'open')
         RETURNING id`,
        [siteId, visitorId]
      );
      
      const conversationId = conversation.rows[0].id;
      
      // KRITIK: Socket'i conversation room'una ekle
      const roomName = `conv:${conversationId}`;
      socket.join(roomName);
      logger.info(`Visitor room'a katıldı: ${roomName}`);
      
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
      
      const newConversationData = {
        id: conversationId,
        site_id: siteId,
        visitor_id: visitorId,
        status: 'open',
        created_at: new Date().toISOString(), // Or from DB if you prefer
        visitor_name: visitorInfo?.name || 'Misafir',
        last_message: 'Sohbet başlatıldı.'
      };

      // Agent'lara yeni konuşma bildirimi gönder
      io.to(`site:${siteId}:agents`).emit('conversation:new', newConversationData);
      
      logger.info(`Ziyaretçi bağlandı ve yeni konuşma bildirildi - Conversation: ${conversationId}`);
      
    } catch (error) {
      logger.error('Visitor connect hatası:', error);
      socket.emit('error', { message: 'Bağlantı hatası' });
    }
  });
  
  // Agent bağlandı
  socket.on('agent:connect', async (data) => {
    try {
      const { agentId, siteId } = data;
      
      // Eğer siteId varsa o site'a, yoksa global odaya katıl
      if (siteId) {
        socket.join(`site:${siteId}:agents`);
        logger.info(`Agent site'a bağlandı: ${agentId} -> site:${siteId}:agents`);
      } else {
        // Admin veya site_id olmayan kullanıcılar için tüm site'lara bağlan
        const sitesResult = await query('SELECT id FROM sites');
        sitesResult.rows.forEach(site => {
          socket.join(`site:${site.id}:agents`);
        });
        logger.info(`Agent tüm site'lara bağlandı: ${agentId}`);
      }
      
      activeConnections.set(socket.id, {
        type: 'agent',
        agentId,
        siteId: siteId || 'all'
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
      
      logger.info(`Agent bağlandı: ${agentId} (site: ${siteId || 'all'})`);
      
    } catch (error) {
      logger.error('Agent connect hatası:', error);
      socket.emit('error', { message: 'Agent bağlantı hatası' });
    }
  });
  
  // Agent conversation'a katılıyor
  socket.on('agent:join:conversation', async (data) => {
    try {
      const { conversationId, agentId } = data;
      const roomName = `conv:${conversationId}`;
      
      socket.join(roomName);
      logger.info(`Agent room'a katıldı: ${roomName}`);
      
      // Conversation'a agent ata
      await query(
        'UPDATE conversations SET agent_id = $1 WHERE id = $2',
        [agentId, conversationId]
      );
      
      // Visitor'a agent atandığını bildir
      io.to(roomName).emit('agent:joined', { 
        conversationId, 
        agentId,
        message: 'Bir temsilci sohbete katıldı'
      });
      
    } catch (error) {
      logger.error('Agent join conversation hatası:', error);
    }
  });
  
  // Yeni mesaj
  socket.on('message:send', async (data) => {
    try {
      const { conversationId, body, senderType, attachments } = data;
      const connection = activeConnections.get(socket.id);
      
      if (!connection) {
        return socket.emit('error', { message: 'Geçersiz bağlantı' });
      }
      
      if (!body && !attachments) {
        return socket.emit('error', { message: 'Mesaj boş olamaz' });
      }
      
      // Mesajı veritabanına kaydet
      const result = await query(
        `INSERT INTO messages (conversation_id, sender_type, sender_id, body, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [
          conversationId,
          senderType,
          connection.agentId || connection.visitorId,
          body || '',
          attachments ? JSON.stringify(attachments) : null
        ]
      );
      
      const message = result.rows[0];
      const roomName = `conv:${conversationId}`;
      
      // KRITIK: Odadaki herkese mesajı broadcast et
      io.to(roomName).emit('message:received', {
        id: message.id,
        conversationId,
        senderType: message.sender_type,
        sender_id: message.sender_id,
        body: message.body,
        attachments: message.attachments,
        createdAt: message.created_at
      });
      
      logger.info(`Mesaj gönderildi - Room: ${roomName}, Sender: ${senderType}`);

      // Konuşmayı güncellediğini agent'lara bildir (tam bilgilerle)
      const conversationDetails = await query(
        `SELECT 
          c.id,
          c.site_id,
          c.status,
          c.created_at,
          c.agent_id,
          agent.name as agent_name,
          v.name as visitor_name,
          v.email as visitor_email
         FROM conversations c
         LEFT JOIN visitors v ON c.visitor_id = v.id
         LEFT JOIN users agent ON c.agent_id = agent.id
         WHERE c.id = $1`,
        [conversationId]
      );
      
      if (conversationDetails.rows.length > 0) {
        const conv = conversationDetails.rows[0];
        io.to(`site:${conv.site_id}:agents`).emit('conversation:update', {
          id: conv.id,
          status: conv.status,
          created_at: conv.created_at,
          agent_id: conv.agent_id,
          agent_name: conv.agent_name,
          visitor_name: conv.visitor_name,
          visitor_email: conv.visitor_email,
          last_message: body,
          last_message_time: message.created_at
        });
      }
      
      logger.info(`Mesaj gönderildi - Conversation: ${conversationId}`);
      
      // Eğer visitor mesajıysa ve agent yoksa, AI otomatik yanıt ver
      if (senderType === 'visitor') {
        // Konuşmaya atanmış agent var mı kontrol et
        const convResult = await query(
          'SELECT agent_id FROM conversations WHERE id = $1',
          [conversationId]
        );
        
        const hasAgent = convResult.rows[0]?.agent_id;
        
        if (!hasAgent) {
          // Agent yok, AI yanıt ver
          logger.info(`Agent yok, AI yanıt üretiliyor - Conversation: ${conversationId}`);
          
          // "Yazıyor..." göster
          io.to(roomName).emit('typing:agent');
          
          try {
            const { generateRagResponseStream } = require('../rag/rag.service');
            const result = await generateRagResponseStream(conversationId, body);
            
            if (result && result.stream) {
              let fullResponse = '';
              
              // Stream'i oku
              const reader = result.stream.getReader();
              const decoder = new TextDecoder();
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.response) {
                      fullResponse += parsed.response;
                      
                      // Her chunk'ı gönder
                      io.to(roomName).emit('message:chunk', {
                        conversationId,
                        chunk: parsed.response
                      });
                    }
                  } catch (e) {
                    // JSON parse hatası, atla
                  }
                }
              }
              
              // "Yazıyor..." gizle
              io.to(roomName).emit('typing:stop');
              
              // Tam yanıtı kaydet
              if (fullResponse) {
                const aiMessage = await query(
                  `INSERT INTO messages (conversation_id, sender_type, sender_id, body, created_at)
                   VALUES ($1, 'bot', NULL, $2, NOW())
                   RETURNING *`,
                  [conversationId, fullResponse]
                );
                
                // Tam mesajı gönder
                io.to(roomName).emit('message:received', {
                  id: aiMessage.rows[0].id,
                  conversationId,
                  senderType: 'bot',
                  body: fullResponse,
                  sources: result.sources,
                  createdAt: aiMessage.rows[0].created_at
                });
                
                logger.info(`AI yanıtı gönderildi - Conversation: ${conversationId}`);
              }
            }
          } catch (aiError) {
            logger.error('AI yanıt hatası:', aiError);
            io.to(roomName).emit('typing:stop');
          }
        }
      }
      
    } catch (error) {
      logger.error('Message send hatası:', error);
      socket.emit('error', { message: 'Mesaj gönderilemedi' });
    }
  });
  
  // Agent yazıyor bildirimi
  socket.on('typing:start', (data) => {
    const { conversationId } = data;
    const roomName = `conv:${conversationId}`;
    socket.to(roomName).emit('typing:agent');
  });
  
  socket.on('typing:stop', (data) => {
    const { conversationId } = data;
    const roomName = `conv:${conversationId}`;
    socket.to(roomName).emit('typing:stop');
  });
  
  // Visitor yazıyor bildirimi
  socket.on('visitor:typing:start', (data) => {
    const { conversationId } = data;
    const roomName = `conv:${conversationId}`;
    socket.to(roomName).emit('visitor:typing');
  });
  
  socket.on('visitor:typing:stop', (data) => {
    const { conversationId } = data;
    const roomName = `conv:${conversationId}`;
    socket.to(roomName).emit('visitor:typing:stop');
  });
  
  // Bağlantı koptuğunda
  socket.on('disconnect', async (reason) => {
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
        
        logger.info(`Agent bağlantısı kesildi: ${connection.agentId} (Sebep: ${reason})`);
      } else if (connection?.type === 'visitor') {
        logger.info(`Visitor bağlantısı kesildi: ${connection.visitorId} (Sebep: ${reason})`);
      }
      
      activeConnections.delete(socket.id);
      logger.info(`Socket bağlantısı kesildi: ${socket.id}`);
      
    } catch (error) {
      logger.error('Disconnect hatası:', error);
    }
  });
}

module.exports = socketHandler;

