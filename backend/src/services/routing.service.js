/**
 * Chat Routing Service
 * Handles automatic agent assignment based on routing strategies
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');
const { addToQueue, getNextFromQueue, removeFromQueue } = require('./queue.service');

// Routing strategies
const ROUTING_TYPES = {
  ROUND_ROBIN: 'round_robin',
  LEAST_BUSY: 'least_busy',
  SKILL_BASED: 'skill_based',
  MANUAL: 'manual'
};

/**
 * Get available agents for a site
 */
async function getAvailableAgents(siteId, requiredSkills = []) {
  try {
    let sql = `
      SELECT 
        u.id,
        u.name,
        u.current_chats,
        u.max_chats,
        u.skills,
        u.department_id,
        ap.status,
        ap.state
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE (u.site_id = $1 OR u.site_id IS NULL)
      AND u.is_active = true
      AND u.role IN ('agent', 'admin')
      AND ap.status = 'online'
      AND u.current_chats < u.max_chats
      AND (ap.state IS NULL OR ap.state = 'available')
    `;
    
    const params = [siteId];
    
    // If skills required, filter by skills
    if (requiredSkills.length > 0) {
      sql += ` AND u.skills ?| $2`;
      params.push(requiredSkills);
    }
    
    sql += ' ORDER BY u.current_chats ASC';
    
    const result = await query(sql, params);
    return result.rows;
    
  } catch (error) {
    logger.error('GetAvailableAgents error:', error);
    return [];
  }
}

/**
 * Get routing configuration for a site
 */
async function getRoutingConfig(siteId) {
  try {
    const result = await query(
      'SELECT * FROM routing_config WHERE site_id = $1',
      [siteId]
    );
    
    if (result.rows.length === 0) {
      // Return default config
      return {
        routing_type: ROUTING_TYPES.ROUND_ROBIN,
        auto_assign: true,
        max_wait_time: 300,
        settings: {}
      };
    }
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('GetRoutingConfig error:', error);
    return {
      routing_type: ROUTING_TYPES.ROUND_ROBIN,
      auto_assign: true,
      max_wait_time: 300,
      settings: {}
    };
  }
}

/**
 * Round-robin routing
 */
async function roundRobinRouting(siteId) {
  try {
    const agents = await getAvailableAgents(siteId);
    
    if (agents.length === 0) {
      return null;
    }
    
    // Get last assigned agent for this site (or all sites if siteId is NULL)
    const lastAssigned = await query(`
      SELECT agent_id 
      FROM conversation_assignments ca
      JOIN conversations c ON ca.conversation_id = c.id
      WHERE c.site_id = $1 OR $1 IS NULL
      ORDER BY ca.assigned_at DESC
      LIMIT 1
    `, [siteId]);
    
    if (lastAssigned.rows.length === 0) {
      // No previous assignment, return first agent
      return agents[0];
    }
    
    const lastAgentId = lastAssigned.rows[0].agent_id;
    const lastIndex = agents.findIndex(a => a.id === lastAgentId);
    
    // Get next agent in rotation
    const nextIndex = (lastIndex + 1) % agents.length;
    return agents[nextIndex];
    
  } catch (error) {
    logger.error('RoundRobin routing error:', error);
    // Fallback to least busy on error
    return leastBusyRouting(siteId);
  }
}

/**
 * Least busy routing
 */
async function leastBusyRouting(siteId) {
  try {
    const agents = await getAvailableAgents(siteId);
    
    if (agents.length === 0) {
      return null;
    }
    
    // Already ordered by current_chats ASC
    return agents[0];
    
  } catch (error) {
    logger.error('LeastBusy routing error:', error);
    return null;
  }
}

/**
 * Skill-based routing
 */
async function skillBasedRouting(siteId, requiredSkills = []) {
  try {
    if (requiredSkills.length === 0) {
      // No skills required, fallback to least busy
      return leastBusyRouting(siteId);
    }
    
    const agents = await getAvailableAgents(siteId, requiredSkills);
    
    if (agents.length === 0) {
      // No agents with required skills, fallback to any available agent
      logger.warn(`No agents found with skills: ${requiredSkills.join(', ')}`);
      return leastBusyRouting(siteId);
    }
    
    // Return agent with most matching skills and least busy
    return agents[0];
    
  } catch (error) {
    logger.error('SkillBased routing error:', error);
    return null;
  }
}

/**
 * VIP routing - Route VIP customers to high-priority agents
 */
async function vipRouting(siteId, vipLevel = 0) {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.current_chats,
        u.max_chats,
        u.skills,
        u.priority_level,
        u.department_id,
        ap.status,
        ap.state
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE (u.site_id = $1 OR u.site_id IS NULL)
      AND u.is_active = true
      AND u.role IN ('agent', 'admin')
      AND ap.status = 'online'
      AND u.current_chats < u.max_chats
      AND (ap.state IS NULL OR ap.state = 'available')
      AND u.priority_level >= $2
      ORDER BY u.priority_level DESC, u.current_chats ASC
      LIMIT 1
    `, [siteId, vipLevel]);
    
    if (result.rows.length === 0) {
      logger.warn(`No VIP agents available for site ${siteId}, falling back to regular routing`);
      return leastBusyRouting(siteId);
    }
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('VIP routing error:', error);
    return leastBusyRouting(siteId);
  }
}

/**
 * Language-based routing - Route to agents who speak the visitor's language
 */
async function languageBasedRouting(siteId, visitorLanguage = 'tr') {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.current_chats,
        u.max_chats,
        u.skills,
        u.languages,
        u.priority_level,
        u.department_id,
        ap.status,
        ap.state
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE (u.site_id = $1 OR u.site_id IS NULL)
      AND u.is_active = true
      AND u.role IN ('agent', 'admin')
      AND ap.status = 'online'
      AND u.current_chats < u.max_chats
      AND (ap.state IS NULL OR ap.state = 'available')
      AND (u.languages IS NULL OR $2 = ANY(u.languages))
      ORDER BY u.current_chats ASC
      LIMIT 1
    `, [siteId, visitorLanguage]);
    
    if (result.rows.length === 0) {
      logger.warn(`No agents found for language ${visitorLanguage}, falling back to any agent`);
      return leastBusyRouting(siteId);
    }
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('Language routing error:', error);
    return leastBusyRouting(siteId);
  }
}

/**
 * Department routing - Route to specific department
 */
async function departmentRouting(siteId, departmentId) {
  try {
    const result = await query(`
      SELECT 
        u.id,
        u.name,
        u.current_chats,
        u.max_chats,
        u.skills,
        u.department_id,
        ap.status,
        ap.state
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE (u.site_id = $1 OR u.site_id IS NULL)
      AND u.is_active = true
      AND u.role IN ('agent', 'admin')
      AND ap.status = 'online'
      AND u.current_chats < u.max_chats
      AND (ap.state IS NULL OR ap.state = 'available')
      AND (u.department_id = $2 OR u.department_id IS NULL)
      ORDER BY u.current_chats ASC
      LIMIT 1
    `, [siteId, departmentId]);
    
    if (result.rows.length === 0) {
      logger.warn(`No agents found for department ${departmentId}, falling back to any agent`);
      return leastBusyRouting(siteId);
    }
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('Department routing error:', error);
    return leastBusyRouting(siteId);
  }
}

/**
 * Helper: Finalize agent assignment
 */
async function finalizeAssignment(conversationId, agent, assignmentType = 'auto') {
  try {
    // Assign agent to conversation
    await query(
      'UPDATE conversations SET agent_id = $1 WHERE id = $2',
      [agent.id, conversationId]
    );
    
    // Record assignment
    try {
      await query(`
        INSERT INTO conversation_assignments (conversation_id, agent_id, assignment_type)
        VALUES ($1, $2, $3)
      `, [conversationId, agent.id, assignmentType]);
    } catch (err) {
      logger.warn('Failed to record assignment:', err.message);
    }
    
    // Increment agent's chat count
    await query(
      'UPDATE users SET current_chats = current_chats + 1 WHERE id = $1',
      [agent.id]
    );
    
    logger.info(`Agent ${agent.id} (${agent.name}) assigned to conversation ${conversationId} via ${assignmentType} routing`);
    
    // Notify agent
    const io = global.socketIO;
    if (io) {
      io.to(`user:${agent.id}`).emit('conversation:assigned', {
        conversationId,
        assignmentType
      });
    }
    
    return agent;
  } catch (error) {
    logger.error('FinalizeAssignment error:', error);
    throw error;
  }
}

/**
 * Main routing function - assigns agent to conversation
 */
async function assignAgentToConversation(conversationId, siteId, requiredSkills = [], options = {}) {
  try {
    const config = await getRoutingConfig(siteId);
    
    if (!config.auto_assign) {
      logger.info(`Auto-assign disabled for site ${siteId}`);
      return null;
    }
    
    // Get visitor info for VIP and language routing
    const visitorResult = await query(`
      SELECT v.is_vip, v.vip_level, v.language
      FROM conversations c
      JOIN visitors v ON c.visitor_id = v.id
      WHERE c.id = $1
    `, [conversationId]);
    
    const visitor = visitorResult.rows[0] || {};
    const { departmentId } = options;
    
    let selectedAgent = null;
    
    // Priority routing order:
    // 1. VIP routing (if visitor is VIP)
    // 2. Department routing (if department specified)
    // 3. Language routing (if visitor has specific language)
    // 4. Configured routing strategy
    
    if (visitor.is_vip && visitor.vip_level > 0) {
      logger.info(`VIP routing for conversation ${conversationId}, VIP level: ${visitor.vip_level}`);
      selectedAgent = await vipRouting(siteId, visitor.vip_level);
      if (selectedAgent) return await finalizeAssignment(conversationId, selectedAgent, 'vip');
    }
    
    if (departmentId) {
      logger.info(`Department routing for conversation ${conversationId}, department: ${departmentId}`);
      selectedAgent = await departmentRouting(siteId, departmentId);
      if (selectedAgent) return await finalizeAssignment(conversationId, selectedAgent, 'department');
    }
    
    if (visitor.language && visitor.language !== 'tr') {
      logger.info(`Language routing for conversation ${conversationId}, language: ${visitor.language}`);
      selectedAgent = await languageBasedRouting(siteId, visitor.language);
      if (selectedAgent) return await finalizeAssignment(conversationId, selectedAgent, 'language');
    }
    
    // Use configured routing strategy
    switch (config.routing_type) {
      case ROUTING_TYPES.ROUND_ROBIN:
        selectedAgent = await roundRobinRouting(siteId);
        break;
        
      case ROUTING_TYPES.LEAST_BUSY:
        selectedAgent = await leastBusyRouting(siteId);
        break;
        
      case ROUTING_TYPES.SKILL_BASED:
        selectedAgent = await skillBasedRouting(siteId, requiredSkills);
        break;
        
      case ROUTING_TYPES.MANUAL:
        logger.info(`Manual routing enabled for site ${siteId}, skipping auto-assign`);
        return null;
        
      default:
        selectedAgent = await leastBusyRouting(siteId);
    }
    
    if (!selectedAgent) {
      logger.warn(`No available agent found for conversation ${conversationId}`);
      
      // Add to queue instead
      const conversationData = await query(
        'SELECT visitor_id FROM conversations WHERE id = $1',
        [conversationId]
      );
      
      if (conversationData.rows.length > 0) {
        const visitorId = conversationData.rows[0].visitor_id;
        const queueEntry = await addToQueue(conversationId, visitorId, siteId, {
          requiredSkills,
          priority: visitor.is_vip ? visitor.vip_level : 0
        });
        
        // Notify visitor about queue position
        const io = global.socketIO;
        if (io) {
          io.to(`conv:${conversationId}`).emit('queue:added', {
            position: queueEntry.queue_position,
            estimatedWaitMinutes: queueEntry.estimated_wait_minutes,
            message: `Tüm temsilcilerimiz meşgul. Sıranız: ${queueEntry.queue_position}. Tahmini bekleme süresi: ${queueEntry.estimated_wait_minutes} dakika.`
          });
        }
        
        logger.info(`Conversation ${conversationId} added to queue at position ${queueEntry.queue_position}`);
      }
      
      return null;
    }
    
    // Finalize assignment
    return await finalizeAssignment(conversationId, selectedAgent, config.routing_type);
    
  } catch (error) {
    logger.error('AssignAgent error:', error);
    return null;
  }
}

/**
 * Transfer conversation to another agent
 */
async function transferConversation(conversationId, fromAgentId, toAgentId) {
  try {
    // Check if target agent is available
    const targetAgent = await query(`
      SELECT u.id, u.current_chats, u.max_chats, ap.status
      FROM users u
      LEFT JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.id = $1
    `, [toAgentId]);
    
    if (targetAgent.rows.length === 0) {
      throw new Error('Target agent not found');
    }
    
    const agent = targetAgent.rows[0];
    
    if (agent.status !== 'online') {
      throw new Error('Target agent is not online');
    }
    
    if (agent.current_chats >= agent.max_chats) {
      throw new Error('Target agent is at max capacity');
    }
    
    // Update conversation
    await query(
      'UPDATE conversations SET agent_id = $1 WHERE id = $2',
      [toAgentId, conversationId]
    );
    
    // Record transfer
    await query(`
      INSERT INTO conversation_assignments (conversation_id, agent_id, assignment_type)
      VALUES ($1, $2, 'transfer')
    `, [conversationId, toAgentId]);
    
    // Update agent chat counts
    if (fromAgentId) {
      await query(
        'UPDATE users SET current_chats = GREATEST(current_chats - 1, 0) WHERE id = $1',
        [fromAgentId]
      );
    }
    
    await query(
      'UPDATE users SET current_chats = current_chats + 1 WHERE id = $1',
      [toAgentId]
    );
    
    logger.info(`Conversation ${conversationId} transferred from ${fromAgentId} to ${toAgentId}`);
    
    return true;
    
  } catch (error) {
    logger.error('TransferConversation error:', error);
    throw error;
  }
}

/**
 * Unassign agent from conversation (when chat ends)
 * Also triggers auto-assignment from queue if agent becomes available
 */
async function unassignAgent(conversationId, agentId) {
  try {
    // Decrease agent's current chat count
    await query(
      'UPDATE users SET current_chats = GREATEST(current_chats - 1, 0) WHERE id = $1',
      [agentId]
    );
    
    logger.info(`Agent ${agentId} unassigned from conversation ${conversationId}`);
    
    // Check if agent is now available for new chats
    const agentResult = await query(`
      SELECT u.id, u.site_id, u.current_chats, u.max_chats, u.skills, u.department_id
      FROM users u
      JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE u.id = $1 AND ap.status = 'online' AND u.current_chats < u.max_chats
    `, [agentId]);
    
    if (agentResult.rows.length > 0) {
      const agent = agentResult.rows[0];
      const siteId = agent.site_id;
      
      // Try to assign next conversation from queue
      const nextInQueue = await getNextFromQueue(
        siteId || null, 
        agent.skills || [], 
        agent.department_id
      );
      
      if (nextInQueue) {
        // Remove from queue
        await removeFromQueue(nextInQueue.conversation_id, 'assigned');
        
        // Assign to this agent
        await query(
          'UPDATE conversations SET agent_id = $1 WHERE id = $2',
          [agent.id, nextInQueue.conversation_id]
        );
        
        // Increment agent's chat count
        await query(
          'UPDATE users SET current_chats = current_chats + 1 WHERE id = $1',
          [agent.id]
        );
        
        // Notify agent about new assignment
        const io = global.socketIO;
        if (io) {
          io.to(`site:${siteId || 'all'}:agents`).emit('conversation:assigned', {
            conversationId: nextInQueue.conversation_id,
            agentId: agent.id,
            visitorId: nextInQueue.visitor_id
          });
          
          // Notify visitor
          io.to(`conv:${nextInQueue.conversation_id}`).emit('agent:assigned', {
            agentId: agent.id,
            message: 'Bir temsilci size bağlandı!'
          });
        }
        
        logger.info(`Auto-assigned conversation ${nextInQueue.conversation_id} from queue to agent ${agent.id}`);
      }
    }
    
  } catch (error) {
    logger.error('UnassignAgent error:', error);
  }
}

/**
 * Update routing configuration
 */
async function updateRoutingConfig(siteId, config) {
  try {
    const result = await query(`
      INSERT INTO routing_config (site_id, routing_type, auto_assign, max_wait_time, settings)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (site_id)
      DO UPDATE SET 
        routing_type = $2,
        auto_assign = $3,
        max_wait_time = $4,
        settings = $5,
        updated_at = NOW()
      RETURNING *
    `, [
      siteId,
      config.routing_type,
      config.auto_assign,
      config.max_wait_time,
      JSON.stringify(config.settings || {})
    ]);
    
    logger.info(`Routing config updated for site ${siteId}`);
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('UpdateRoutingConfig error:', error);
    throw error;
  }
}

module.exports = {
  getAvailableAgents,
  getRoutingConfig,
  assignAgentToConversation,
  transferConversation,
  vipRouting,
  languageBasedRouting,
  departmentRouting,
  roundRobinRouting,
  leastBusyRouting,
  skillBasedRouting,
  unassignAgent,
  updateRoutingConfig,
  ROUTING_TYPES
};
