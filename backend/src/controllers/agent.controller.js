/**
 * Agent Management Controller
 * Manages agents, departments, and agent operations
 */

const bcrypt = require('bcryptjs');
const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');

// Get all agents for a site
async function getAgents(req, res) {
  try {
    const { siteId } = req.query;
    
    let sql = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.department_id,
        d.name as department_name,
        u.max_chats,
        u.current_chats,
        u.skills,
        u.is_active,
        ap.status as online_status,
        ap.last_seen,
        u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.role IN ('agent', 'admin')
    `;
    
    const params = [];
    if (siteId) {
      sql += ' AND u.site_id = $1';
      params.push(siteId);
    }
    
    sql += ' ORDER BY u.created_at DESC';
    
    const result = await query(sql, params);
    
    res.json({ agents: result.rows });
    
  } catch (error) {
    logger.error('GetAgents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
}

// Get single agent details
async function getAgent(req, res) {
  try {
    const { agentId } = req.params;
    
    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.department_id,
        d.name as department_name,
        u.max_chats,
        u.current_chats,
        u.skills,
        u.is_active,
        ap.status as online_status,
        ap.last_seen,
        u.created_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.id = $1
    `, [agentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({ agent: result.rows[0] });
    
  } catch (error) {
    logger.error('GetAgent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
}

// Create new agent
async function createAgent(req, res) {
  try {
    const { name, email, password, role = 'agent', department_id, max_chats = 5, skills = [] } = req.body;
    const siteId = req.user.site_id;
    
    // Check if email already exists
    const existingAgent = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingAgent.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create agent
    const result = await query(`
      INSERT INTO users (
        name, email, password_hash, role, site_id, 
        department_id, max_chats, skills, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, name, email, role, department_id, max_chats, skills, created_at
    `, [name, email, passwordHash, role, siteId, department_id, max_chats, JSON.stringify(skills)]);
    
    const agent = result.rows[0];
    
    // Initialize presence
    await query(`
      INSERT INTO agents_presence (agent_id, status)
      VALUES ($1, 'offline')
    `, [agent.id]);
    
    logger.info(`New agent created: ${email}`);
    
    res.status(201).json({ 
      message: 'Agent created successfully',
      agent 
    });
    
  } catch (error) {
    logger.error('CreateAgent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
}

// Update agent
async function updateAgent(req, res) {
  try {
    const { agentId } = req.params;
    const { name, email, role, department_id, max_chats, skills, is_active } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      params.push(email);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      params.push(role);
    }
    if (department_id !== undefined) {
      updates.push(`department_id = $${paramCount++}`);
      params.push(department_id);
    }
    if (max_chats !== undefined) {
      updates.push(`max_chats = $${paramCount++}`);
      params.push(max_chats);
    }
    if (skills !== undefined) {
      updates.push(`skills = $${paramCount++}`);
      params.push(JSON.stringify(skills));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    params.push(agentId);
    
    const result = await query(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, department_id, max_chats, skills, is_active
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    logger.info(`Agent updated: ${agentId}`);
    
    res.json({ 
      message: 'Agent updated successfully',
      agent: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdateAgent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
}

// Delete agent
async function deleteAgent(req, res) {
  try {
    const { agentId } = req.params;
    
    await transaction(async (client) => {
      // Remove from presence
      await client.query('DELETE FROM agents_presence WHERE agent_id = $1', [agentId]);
      
      // Unassign from conversations
      await client.query('UPDATE conversations SET agent_id = NULL WHERE agent_id = $1', [agentId]);
      
      // Delete agent
      await client.query('DELETE FROM users WHERE id = $1', [agentId]);
    });
    
    logger.info(`Agent deleted: ${agentId}`);
    
    res.json({ message: 'Agent deleted successfully' });
    
  } catch (error) {
    logger.error('DeleteAgent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
}

// Update agent status (online/offline/busy/away)
async function updateAgentStatus(req, res) {
  try {
    const { agentId } = req.params;
    const { status } = req.body;
    
    if (!['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await query(`
      INSERT INTO agents_presence (agent_id, status, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (agent_id) 
      DO UPDATE SET status = $2, last_seen = NOW()
    `, [agentId, status]);
    
    // Broadcast status change to all clients
    const io = global.socketIO;
    if (io) {
      io.emit('agent:status:changed', { agentId, status });
    }
    
    logger.info(`Agent status updated: ${agentId} -> ${status}`);
    
    res.json({ message: 'Status updated successfully' });
    
  } catch (error) {
    logger.error('UpdateAgentStatus error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

// Get agent statistics
async function getAgentStats(req, res) {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Total conversations handled
    const totalConvs = await query(`
      SELECT COUNT(*) as total
      FROM conversations
      WHERE agent_id = $1
      ${startDate ? 'AND created_at >= $2' : ''}
      ${endDate ? 'AND created_at <= $3' : ''}
    `, [agentId, startDate, endDate].filter(Boolean));
    
    // Average response time
    const avgResponseTime = await query(`
      SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) as avg_seconds
      FROM messages m1
      JOIN messages m2 ON m2.conversation_id = m1.conversation_id
      JOIN conversations c ON c.id = m1.conversation_id
      WHERE c.agent_id = $1
      AND m1.sender_type = 'visitor'
      AND m2.sender_type = 'agent'
      AND m2.created_at > m1.created_at
    `, [agentId]);
    
    // Average rating
    const avgRating = await query(`
      SELECT AVG(rating) as avg_rating
      FROM conversations
      WHERE agent_id = $1 AND rating IS NOT NULL
    `, [agentId]);
    
    res.json({
      stats: {
        total_conversations: parseInt(totalConvs.rows[0].total),
        avg_response_time: parseFloat(avgResponseTime.rows[0].avg_seconds || 0),
        avg_rating: parseFloat(avgRating.rows[0].avg_rating || 0),
        current_chats: 0 // Will be updated from real-time data
      }
    });
    
  } catch (error) {
    logger.error('GetAgentStats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  updateAgentStatus,
  getAgentStats
};
