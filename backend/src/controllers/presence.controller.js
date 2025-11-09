/**
 * Presence Controller
 * Manages agent online/offline/away status
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Get all agents presence
async function getAllAgentsPresence(req, res) {
  try {
    const { siteId } = req.query;
    
    let sql = `
      SELECT 
        ap.*,
        u.name as agent_name,
        u.email as agent_email
      FROM agents_presence ap
      JOIN users u ON ap.agent_id = u.id
      WHERE u.role IN ('admin', 'agent')
    `;
    
    const params = [];
    
    if (siteId) {
      sql += ` AND u.site_id = $1`;
      params.push(siteId);
    }
    
    sql += ` ORDER BY ap.status, u.name`;
    
    const result = await query(sql, params);
    
    res.json({ agents: result.rows });
    
  } catch (error) {
    logger.error('GetAllAgentsPresence error:', error);
    res.status(500).json({ error: 'Failed to fetch agents presence' });
  }
}

// Get single agent presence
async function getAgentPresence(req, res) {
  try {
    const { agentId } = req.params;
    
    const result = await query(`
      SELECT 
        ap.*,
        u.name as agent_name,
        u.email as agent_email
      FROM agents_presence ap
      JOIN users u ON ap.agent_id = u.id
      WHERE ap.agent_id = $1
    `, [agentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({ presence: result.rows[0] });
    
  } catch (error) {
    logger.error('GetAgentPresence error:', error);
    res.status(500).json({ error: 'Failed to fetch agent presence' });
  }
}

// Update agent status
async function updateAgentStatus(req, res) {
  try {
    const userId = req.user.id;
    const { status, customStatus } = req.body;
    
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await query(`
      UPDATE agents_presence
      SET status = $1, custom_status = $2, updated_at = NOW()
      WHERE agent_id = $3
      RETURNING *
    `, [status, customStatus, userId]);
    
    if (result.rows.length === 0) {
      // Create if not exists
      const createResult = await query(`
        INSERT INTO agents_presence (agent_id, status, custom_status)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [userId, status, customStatus]);
      
      logger.info(`Agent presence created: ${userId} - ${status}`);
      
      return res.json({
        message: 'Status updated',
        presence: createResult.rows[0]
      });
    }
    
    logger.info(`Agent status updated: ${userId} - ${status}`);
    
    // Broadcast status change via Socket.IO
    const io = global.socketIO;
    if (io) {
      io.emit('agent:status:changed', {
        agentId: userId,
        status,
        customStatus
      });
    }
    
    res.json({
      message: 'Status updated',
      presence: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdateAgentStatus error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

// Get online agents count
async function getOnlineAgentsCount(req, res) {
  try {
    const { siteId } = req.query;
    
    let sql = `
      SELECT COUNT(*) as count
      FROM agents_presence ap
      JOIN users u ON ap.agent_id = u.id
      WHERE ap.status IN ('online', 'away')
    `;
    
    const params = [];
    
    if (siteId) {
      sql += ` AND u.site_id = $1`;
      params.push(siteId);
    }
    
    const result = await query(sql, params);
    
    res.json({ count: parseInt(result.rows[0].count) });
    
  } catch (error) {
    logger.error('GetOnlineAgentsCount error:', error);
    res.status(500).json({ error: 'Failed to fetch online agents count' });
  }
}

// Get typing status for conversation
async function getTypingStatus(req, res) {
  try {
    const { conversationId } = req.params;
    
    const result = await query(`
      SELECT 
        ts.*,
        u.name as user_name
      FROM typing_status ts
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE ts.conversation_id = $1
      AND ts.started_at > NOW() - INTERVAL '10 seconds'
    `, [conversationId]);
    
    res.json({ typing: result.rows });
    
  } catch (error) {
    logger.error('GetTypingStatus error:', error);
    res.status(500).json({ error: 'Failed to fetch typing status' });
  }
}

module.exports = {
  getAllAgentsPresence,
  getAgentPresence,
  updateAgentStatus,
  getOnlineAgentsCount,
  getTypingStatus
};
