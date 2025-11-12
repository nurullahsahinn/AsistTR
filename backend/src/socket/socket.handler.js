/**
 * Socket.IO Event Handler
 * Gerçek zamanlı mesajlaşma için WebSocket yönetimi
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');
const { assignAgentToConversation, unassignAgent } = require('../services/routing.service');

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
      const { apiKey, sessionId, visitorInfo, resumeConversationId, resumeVisitorId } = data;
      
      logger.info('Visitor connect attempt:', { apiKey, sessionId, visitorInfo, resumeConversationId });
      
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
        
        // Mevcut visitor'ın bilgilerini ve aktif conversation durumunu kontrol et
        const visitorCheck = await query(
          `SELECT v.name, 
                  (SELECT COUNT(*) FROM conversations c WHERE c.visitor_id = v.id AND c.status = 'open') as open_conversations
           FROM visitors v WHERE v.id = $1`,
          [visitorId]
        );
        const currentName = visitorCheck.rows[0]?.name;
        const hasOpenConversations = visitorCheck.rows[0]?.open_conversations > 0;
        
        // Mevcut ziyaretçinin bilgilerini güncelle (SADECE yeni bilgi varsa)
        // Name'i güncelle eğer:
        // 1. Yeni isim var ve "Misafir" değil
        // 2. VE (mevcut isim yok VEYA mevcut isim "Misafir" VEYA aktif sohbet yok)
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        const shouldUpdateName = visitorInfo?.name && 
                                 visitorInfo.name !== 'Misafir' && 
                                 (!currentName || currentName === 'Misafir' || !hasOpenConversations);
        
        if (shouldUpdateName) {
          updateFields.push(`name = $${paramIndex++}`);
          updateValues.push(visitorInfo.name);
          logger.info(`✏️ Updating visitor name from "${currentName}" to "${visitorInfo.name}" (open_chats: ${hasOpenConversations})`);
        } else {
          logger.info(`✅ Keeping existing visitor name: "${currentName}" (new: "${visitorInfo?.name}", open_chats: ${hasOpenConversations})`);
        }
        
        if (visitorInfo?.email) {
          updateFields.push(`email = $${paramIndex++}`);
          updateValues.push(visitorInfo.email);
        }
        
        // Meta, IP ve User Agent her zaman güncelle
        updateFields.push(`meta = $${paramIndex++}`);
        updateValues.push(JSON.stringify(visitorInfo || {}));
        
        updateFields.push(`ip_address = $${paramIndex++}`);
        updateValues.push(socket.handshake.address);
        
        updateFields.push(`user_agent = $${paramIndex++}`);
        updateValues.push(socket.handshake.headers['user-agent']);
        
        updateFields.push(`last_seen = $${paramIndex++}`);
        updateValues.push(new Date());
        
        updateValues.push(visitorId);
        
        if (updateFields.length > 0) {
          await query(
            `UPDATE visitors SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            updateValues
          );
        }
        
        logger.info('Existing visitor found:', visitorId);
      }
      
      // Konuşma oluştur VEYA mevcut conversation'a bağlan
      let conversationId;
      let isResumed = false;
      let previousMessages = [];
      
      // Eğer resume conversation id varsa, kontrol et
      if (resumeConversationId && resumeVisitorId === visitorId) {
        const existingConv = await query(
          `SELECT id, status FROM conversations 
           WHERE id = $1 AND visitor_id = $2 AND status = 'open'`,
          [resumeConversationId, visitorId]
        );
        
        if (existingConv.rows.length > 0) {
          conversationId = existingConv.rows[0].id;
          isResumed = true;
          
          // Önceki mesajları getir
          const messagesResult = await query(
            `SELECT sender_type, body, created_at 
             FROM messages 
             WHERE conversation_id = $1 
             ORDER BY created_at ASC 
             LIMIT 50`,
            [conversationId]
          );
          previousMessages = messagesResult.rows;
          
          logger.info(`✅ RESUMED conversation: ${conversationId}`);
        } else {
          logger.info(`⚠️ Resume failed, conversation closed or not found`);
        }
      }
      
      // Eğer resume edilemedi ise yeni conversation aç
      if (!conversationId) {
        const conversation = await query(
          `INSERT INTO conversations (site_id, visitor_id, status)
           VALUES ($1, $2, 'open')
           RETURNING id`,
          [siteId, visitorId]
        );
        conversationId = conversation.rows[0].id;
        logger.info(`🆕 NEW conversation: ${conversationId}`);
      }
      
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
        visitorId,
        isResumed,
        messages: isResumed ? previousMessages : []
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
      
      // Auto-assign agent using routing service
      try {
        const assignedAgent = await assignAgentToConversation(conversationId, siteId);
        
        if (assignedAgent) {
          logger.info(`Agent ${assignedAgent.id} auto-assigned to conversation ${conversationId}`);
          
          // Notify the assigned agent
          io.to(`site:${siteId}:agents`).emit('conversation:assigned', {
            conversationId,
            agentId: assignedAgent.id,
            agentName: assignedAgent.name
          });
          
          // Notify visitor that agent joined
          io.to(roomName).emit('agent:joined', {
            conversationId,
            agentId: assignedAgent.id,
            message: 'Bir temsilci sohbete katıldı'
          });
        }
      } catch (autoAssignError) {
        logger.error('Auto-assign error:', autoAssignError);
        // Continue even if auto-assign fails
      }
      
    } catch (error) {
      logger.error('Visitor connect hatası:', error);
      socket.emit('error', { message: 'Bağlantı hatası' });
    }
  });
  
  // Agent bağlandı
  socket.on('agent:connect', async (data) => {
    try {
      const { agentId, siteId } = data;
      
      // CRITICAL: Agent'ı user room'una ekle (direct messaging için)
      socket.join(`user:${agentId}`);
      logger.info(`✅ Agent user room'una katıldı: user:${agentId}`);
      
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
  
  // WebRTC Signaling için event'ler
  
  // WebRTC Offer gönderme
  socket.on('voice:webrtc:offer', async (data) => {
    try {
      const { voiceCallId, conversationId, offer } = data;
      const connection = activeConnections.get(socket.id);
      
      if (!connection) {
        return socket.emit('error', { message: 'Geçersiz bağlantı' });
      }
      
      // Offer'ı veritabanına kaydet
      await query(
        `INSERT INTO webrtc_signaling (voice_call_id, from_type, from_id, signal_type, signal_data)
         VALUES ($1, $2, $3, 'offer', $4)`,
        [voiceCallId, connection.type, connection.agentId || connection.visitorId, JSON.stringify(offer)]
      );
      
      // Karşı tarafa offer'ı ilet
      const roomName = `conv:${conversationId}`;
      socket.to(roomName).emit('voice:webrtc:offer', {
        voiceCallId,
        offer,
        fromType: connection.type
      });
      
      logger.info(`WebRTC offer gönderildi - Call: ${voiceCallId}, From: ${connection.type}`);
      
    } catch (error) {
      logger.error('WebRTC offer hatası:', error);
      socket.emit('error', { message: 'Offer gönderilemedi' });
    }
  });
  
  // WebRTC Answer gönderme
  socket.on('voice:webrtc:answer', async (data) => {
    try {
      const { voiceCallId, conversationId, answer } = data;
      const connection = activeConnections.get(socket.id);
      
      if (!connection) {
        return socket.emit('error', { message: 'Geçersiz bağlantı' });
      }
      
      // Answer'ı veritabanına kaydet
      await query(
        `INSERT INTO webrtc_signaling (voice_call_id, from_type, from_id, signal_type, signal_data)
         VALUES ($1, $2, $3, 'answer', $4)`,
        [voiceCallId, connection.type, connection.agentId || connection.visitorId, JSON.stringify(answer)]
      );
      
      // Karşı tarafa answer'ı ilet
      const roomName = `conv:${conversationId}`;
      socket.to(roomName).emit('voice:webrtc:answer', {
        voiceCallId,
        answer,
        fromType: connection.type
      });
      
      logger.info(`WebRTC answer gönderildi - Call: ${voiceCallId}, From: ${connection.type}`);
      
    } catch (error) {
      logger.error('WebRTC answer hatası:', error);
      socket.emit('error', { message: 'Answer gönderilemedi' });
    }
  });
  
  // WebRTC ICE Candidate gönderme
  socket.on('voice:webrtc:ice-candidate', async (data) => {
    try {
      const { voiceCallId, conversationId, candidate } = data;
      const connection = activeConnections.get(socket.id);
      
      if (!connection) {
        return socket.emit('error', { message: 'Geçersiz bağlantı' });
      }
      
      // ICE candidate'i veritabanına kaydet
      await query(
        `INSERT INTO webrtc_signaling (voice_call_id, from_type, from_id, signal_type, signal_data)
         VALUES ($1, $2, $3, 'ice-candidate', $4)`,
        [voiceCallId, connection.type, connection.agentId || connection.visitorId, JSON.stringify(candidate)]
      );
      
      // Karşı tarafa ICE candidate'i ilet
      const roomName = `conv:${conversationId}`;
      socket.to(roomName).emit('voice:webrtc:ice-candidate', {
        voiceCallId,
        candidate,
        fromType: connection.type
      });
      
      logger.info(`WebRTC ICE candidate gönderildi - Call: ${voiceCallId}`);
      
    } catch (error) {
      logger.error('WebRTC ICE candidate hatası:', error);
      socket.emit('error', { message: 'ICE candidate gönderilemedi' });
    }
  });
  
  // Çağrı durumu değişiklikleri
  socket.on('voice:call:status', async (data) => {
    try {
      const { voiceCallId, conversationId, status } = data;
      
      // Durumu güncelle
      await query(
        'UPDATE voice_calls SET status = $1 WHERE id = $2',
        [status, voiceCallId]
      );
      
      // Karşı tarafa bildir
      const roomName = `conv:${conversationId}`;
      io.to(roomName).emit('voice:call:status', {
        voiceCallId,
        status
      });
      
      logger.info(`Çağrı durumu değişti - Call: ${voiceCallId}, Status: ${status}`);
      
    } catch (error) {
      logger.error('Call status hatası:', error);
    }
  });
  
  // WebRTC Signaling
  socket.on('voice:signal', async (data) => {
    try {
      const { voiceCallId, signalType, signalData } = data;
      const connection = activeConnections.get(socket.id);

      if (!connection) return;

      const { type, agentId, visitorId } = connection;
      const fromId = type === 'agent' ? agentId : visitorId;

      // Sinyali veritabanına kaydet
      await query(
        `INSERT INTO webrtc_signaling (voice_call_id, from_type, from_id, signal_type, signal_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [voiceCallId, type, fromId, signalType, JSON.stringify(signalData)]
      );

      // Sinyali karşı tarafa ilet
      const callInfo = await query('SELECT conversation_id, agent_id, visitor_id FROM voice_calls WHERE id = $1', [voiceCallId]);
      if (callInfo.rows.length > 0) {
        const { conversation_id, agent_id, visitor_id } = callInfo.rows[0];
        
        let targetSocketId;
        if (type === 'agent') {
          // Agent'tan visitor'a
          for (const [socketId, conn] of activeConnections.entries()) {
            if (conn.visitorId === visitor_id) {
              targetSocketId = socketId;
              break;
            }
          }
        } else {
          // Visitor'dan agent'a
          for (const [socketId, conn] of activeConnections.entries()) {
            if (conn.agentId === agent_id) {
              targetSocketId = socketId;
              break;
            }
          }
        }
        
        if (targetSocketId) {
          io.to(targetSocketId).emit('voice:signal', data);
        }
      }
    } catch (error) {
      logger.error('WebRTC sinyal hatası:', error);
    }
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
        
        // Aktif çağrıları sonlandır
        await query(
          `UPDATE voice_calls 
           SET status = 'ended', end_time = NOW(), disconnect_reason = 'agent_disconnect'
           WHERE agent_id = $1 AND status IN ('connecting', 'active')`,
          [connection.agentId]
        );
        
        // Broadcast agent offline status
        io.emit('agent:status:changed', {
          agentId: connection.agentId,
          status: 'offline'
        });
        
        logger.info(`Agent bağlantısı kesildi: ${connection.agentId} (Sebep: ${reason})`);
      } else if (connection?.type === 'visitor') {
        // Visitor'ın aktif çağrılarını sonlandır
        await query(
          `UPDATE voice_calls 
           SET status = 'ended', end_time = NOW(), disconnect_reason = 'visitor_disconnect'
           WHERE visitor_id = $1 AND status IN ('connecting', 'active')`,
          [connection.visitorId]
        );
        
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

