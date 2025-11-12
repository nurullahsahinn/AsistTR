/**
 * Voice Call Controller
 * Sesli görüşme yönetimi
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// io objesini global değişkenden al
function getIO() {
  return global.socketIO;
}

/**
 * Sesli çağrı başlat
 */
async function initiateCall(req, res) {
  try {
    const { conversationId, visitorId } = req.body;
    
    // Conversation bilgilerini al
    const convResult = await query(
      'SELECT site_id, visitor_id FROM conversations WHERE id = $1',
      [conversationId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Konuşma bulunamadı' });
    }
    
    const { site_id } = convResult.rows[0];
    
    // Voice call kaydı oluştur
    const callResult = await query(
      `INSERT INTO voice_calls (conversation_id, visitor_id, status, caller_type)
       VALUES ($1, $2, 'waiting', 'visitor')
       RETURNING id`,
      [conversationId, visitorId]
    );
    
    const voiceCallId = callResult.rows[0].id;
    
    // Call queue'ya ekle
    const queueResult = await query(
      `INSERT INTO call_queue (voice_call_id, site_id, status, entered_at)
       VALUES ($1, $2, 'queued', NOW())
       RETURNING id, queue_position`,
      [voiceCallId, site_id]
    );
    
    // Müsait agent'ları bul (site_id NULL olan admin'ler de dahil)
    const availableAgents = await query(
      `SELECT u.id, u.name, aca.current_calls, aca.max_concurrent_calls
       FROM users u
       JOIN agent_call_availability aca ON u.id = aca.agent_id
       JOIN agents_presence ap ON u.id = ap.agent_id
       WHERE (u.site_id = $1 OR u.site_id IS NULL)
         AND aca.available_for_calls = true 
         AND aca.current_calls < aca.max_concurrent_calls
         AND ap.status = 'online'
       ORDER BY aca.current_calls ASC, aca.last_call_at ASC NULLS FIRST
       LIMIT 1`,
      [site_id]
    );
    
    const io = getIO();
    
    if (availableAgents.rows.length > 0) {
      const agent = availableAgents.rows[0];
      
      const roomName = `site:${site_id}:agents`;
      logger.info(`📞 Çağrı bildirimi gönderiliyor - Room: ${roomName}, Agent: ${agent.id}`);
      
      // Agent'a çağrı bildirimi gönder
      io.to(roomName).emit('voice:call:incoming', {
        voiceCallId,
        conversationId,
        visitorId,
        agentId: agent.id,
        timestamp: new Date().toISOString()
      });
      
      // Direct emit to agent
      io.to(`user:${agent.id}`).emit('voice:call:incoming', {
        voiceCallId,
        conversationId,
        visitorId,
        agentId: agent.id,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Sesli çağrı başlatıldı - Call ID: ${voiceCallId}, Agent: ${agent.id}`);
      
      res.json({
        voiceCallId,
        status: 'waiting',
        message: 'Bir temsilciye bağlanıyorsunuz...'
      });
    } else {
      // Müsait agent yok
      await query(
        'UPDATE voice_calls SET status = $1 WHERE id = $2',
        ['waiting', voiceCallId]
      );
      
      res.json({
        voiceCallId,
        status: 'queued',
        message: 'Tüm temsilcilerimiz meşgul. Sırada bekliyorsunuz...',
        queuePosition: queueResult.rows[0].queue_position
      });
    }
    
  } catch (error) {
    logger.error('InitiateCall hatası:', error);
    res.status(500).json({ error: 'Çağrı başlatılamadı' });
  }
}

/**
 * Agent çağrıyı kabul ediyor
 */
async function acceptCall(req, res) {
  try {
    const { voiceCallId } = req.params;
    const agentId = req.user.id;
    
    // Call durumunu güncelle
    const result = await query(
      `UPDATE voice_calls 
       SET agent_id = $1, status = 'connecting', start_time = NOW()
       WHERE id = $2 AND status IN ('waiting', 'queued')
       RETURNING conversation_id, visitor_id`,
      [agentId, voiceCallId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Çağrı bulunamadı veya zaten kabul edilmiş' });
    }
    
    const { conversation_id, visitor_id } = result.rows[0];
    
    // Agent'ın aktif çağrı sayısını artır
    await query(
      `INSERT INTO agent_call_availability (agent_id, current_calls, last_call_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (agent_id) 
       DO UPDATE SET 
         current_calls = agent_call_availability.current_calls + 1,
         last_call_at = NOW()`,
      [agentId]
    );
    
    // Queue'dan çıkar
    await query(
      'UPDATE call_queue SET status = $1 WHERE voice_call_id = $2',
      ['assigned', voiceCallId]
    );
    
    // Visitor'a agent'ın çağrıyı kabul ettiğini bildir
    const io = getIO();
    const roomName = `conv:${conversation_id}`;
    
    io.to(roomName).emit('voice:call:accepted', {
      voiceCallId,
      agentId,
      agentName: req.user.name
    });
    
    logger.info(`Çağrı kabul edildi - Call ID: ${voiceCallId}, Agent: ${agentId}`);
    
    res.json({
      voiceCallId,
      conversationId: conversation_id,
      visitorId: visitor_id,
      status: 'connecting'
    });
    
  } catch (error) {
    logger.error('AcceptCall hatası:', error);
    res.status(500).json({ error: 'Çağrı kabul edilemedi' });
  }
}

/**
 * Çağrıyı reddet
 */
async function rejectCall(req, res) {
  try {
    const { voiceCallId } = req.params;
    
    await query(
      `UPDATE voice_calls SET status = 'missed', end_time = NOW()
       WHERE id = $1`,
      [voiceCallId]
    );
    
    res.json({ message: 'Çağrı reddedildi' });
    
  } catch (error) {
    logger.error('RejectCall hatası:', error);
    res.status(500).json({ error: 'Çağrı reddedilemedi' });
  }
}

/**
 * Çağrıyı sonlandır
 */
async function endCall(req, res) {
  try {
    const { voiceCallId } = req.params;
    const { reason = 'user_hangup' } = req.body;
    
    // Call bilgilerini al
    const callInfo = await query(
      `SELECT agent_id, start_time, conversation_id 
       FROM voice_calls 
       WHERE id = $1`,
      [voiceCallId]
    );
    
    if (callInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Çağrı bulunamadı' });
    }
    
    const { agent_id, start_time, conversation_id } = callInfo.rows[0];
    const duration = Math.floor((Date.now() - new Date(start_time).getTime()) / 1000);
    
    // Çağrıyı sonlandır
    await query(
      `UPDATE voice_calls 
       SET status = 'ended', end_time = NOW(), duration = $1, disconnect_reason = $2
       WHERE id = $3`,
      [duration, reason, voiceCallId]
    );
    
    // Agent'ın aktif çağrı sayısını azalt
    if (agent_id) {
      await query(
        `UPDATE agent_call_availability 
         SET current_calls = GREATEST(current_calls - 1, 0),
             total_calls_today = total_calls_today + 1
         WHERE agent_id = $1`,
        [agent_id]
      );
    }
    
    // Her iki tarafa da bildir
    const io = getIO();
    const roomName = `conv:${conversation_id}`;
    
    // Conversation room'a emit (widget için)
    io.to(roomName).emit('voice:call:ended', {
      voiceCallId,
      duration,
      reason
    });
    
    // ✅ Agent'a da direkt emit (dashboard için)
    if (agent_id) {
      io.to(`user:${agent_id}`).emit('voice:call:ended', {
        voiceCallId,
        duration,
        reason
      });
      logger.info(`📞 Call ended notification sent to agent: ${agent_id}`);
    }
    
    logger.info(`Çağrı sonlandırıldı - Call ID: ${voiceCallId}, Duration: ${duration}s`);
    
    res.json({
      message: 'Çağrı sonlandırıldı',
      duration
    });
    
  } catch (error) {
    logger.error('EndCall hatası:', error);
    res.status(500).json({ error: 'Çağrı sonlandırılamadı' });
  }
}

/**
 * Aktif çağrıları listele
 */
async function getActiveCalls(req, res) {
  try {
    const { siteId } = req.query;
    const agentId = req.user.id;
    
    let sql = `
      SELECT 
        vc.id,
        vc.conversation_id,
        vc.status,
        vc.start_time,
        vc.duration,
        v.name as visitor_name,
        u.name as agent_name
      FROM voice_calls vc
      LEFT JOIN visitors v ON vc.visitor_id = v.id
      LEFT JOIN users u ON vc.agent_id = u.id
      WHERE vc.status IN ('waiting', 'connecting', 'active')
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (siteId) {
      sql += ` AND v.site_id = $${paramCount}`;
      params.push(siteId);
      paramCount++;
    }
    
    if (req.user.role !== 'admin') {
      sql += ` AND (vc.agent_id = $${paramCount} OR vc.agent_id IS NULL)`;
      params.push(agentId);
    }
    
    sql += ' ORDER BY vc.start_time DESC';
    
    const result = await query(sql, params);
    
    res.json({ calls: result.rows });
    
  } catch (error) {
    logger.error('GetActiveCalls hatası:', error);
    res.status(500).json({ error: 'Çağrılar alınamadı' });
  }
}

/**
 * Agent'ın müsaitlik durumunu güncelle
 */
async function updateCallAvailability(req, res) {
  try {
    const agentId = req.user.id;
    const { availableForCalls, maxConcurrentCalls } = req.body;
    
    await query(
      `INSERT INTO agent_call_availability (agent_id, available_for_calls, max_concurrent_calls)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id) 
       DO UPDATE SET 
         available_for_calls = $2,
         max_concurrent_calls = $3,
         updated_at = NOW()`,
      [agentId, availableForCalls, maxConcurrentCalls || 1]
    );
    
    logger.info(`Agent müsaitlik güncellendi - Agent: ${agentId}, Available: ${availableForCalls}`);
    
    res.json({ message: 'Müsaitlik durumu güncellendi' });
    
  } catch (error) {
    logger.error('UpdateCallAvailability hatası:', error);
    res.status(500).json({ error: 'Müsaitlik güncellenemedi' });
  }
}

/**
 * Konuşmaya ait arama geçmişini getir
 */
async function getCallHistory(req, res) {
  try {
    const { conversationId } = req.params;
    
    const result = await query(
      `SELECT 
        id,
        conversation_id,
        status,
        start_time,
        end_time,
        duration,
        caller_type,
        disconnect_reason
      FROM voice_calls
      WHERE conversation_id = $1
      ORDER BY start_time DESC`,
      [conversationId]
    );
    
    res.json({ calls: result.rows });
    
  } catch (error) {
    logger.error('GetCallHistory hatası:', error);
    res.status(500).json({ error: 'Arama geçmişi alınamadı' });
  }
}

module.exports = {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getActiveCalls,
  updateCallAvailability,
  getCallHistory
};
