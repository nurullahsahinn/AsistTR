/**
 * Queue Service
 * Manages chat queue system - adding visitors to queue, auto-assignment, position tracking
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Add visitor to chat queue
 * @param {string} conversationId - Conversation ID
 * @param {string} visitorId - Visitor ID
 * @param {string} siteId - Site ID
 * @param {object} options - Queue options (priority, skills, department)
 * @returns {object} Queue entry with position and estimated wait time
 */
async function addToQueue(conversationId, visitorId, siteId, options = {}) {
  try {
    const {
      priority = 0,
      requiredSkills = [],
      preferredDepartmentId = null,
      timeoutMinutes = 30
    } = options;

    // Check if already in queue
    const existing = await query(
      'SELECT id FROM chat_queue WHERE conversation_id = $1 AND status = $2',
      [conversationId, 'waiting']
    );

    if (existing.rows.length > 0) {
      logger.warn(`Conversation ${conversationId} already in queue`);
      return await getQueueStatus(conversationId);
    }

    // Calculate queue position
    const positionResult = await query(`
      SELECT COUNT(*) + 1 as position
      FROM chat_queue
      WHERE site_id = $1 
        AND status = 'waiting'
        AND priority >= $2
    `, [siteId, priority]);

    const queuePosition = parseInt(positionResult.rows[0].position);

    // Calculate estimated wait time
    const estimatedWait = await calculateEstimatedWaitTime(siteId, queuePosition);

    // Calculate timeout
    const timeoutAt = new Date();
    timeoutAt.setMinutes(timeoutAt.getMinutes() + timeoutMinutes);

    // Insert into queue
    const result = await query(`
      INSERT INTO chat_queue (
        conversation_id, visitor_id, site_id, priority, queue_position,
        estimated_wait_minutes, required_skills, preferred_department_id,
        timeout_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      conversationId, visitorId, siteId, priority, queuePosition,
      estimatedWait, requiredSkills, preferredDepartmentId,
      timeoutAt, 'waiting'
    ]);

    logger.info(`Added to queue - Conversation: ${conversationId}, Position: ${queuePosition}`);

    // Broadcast queue update to all agents
    const io = global.socketIO;
    if (io) {
      io.to(`site:${siteId}:agents`).emit('queue:updated', {
        siteId,
        queueLength: queuePosition
      });
    }

    return result.rows[0];

  } catch (error) {
    logger.error('AddToQueue error:', error);
    throw error;
  }
}

/**
 * Calculate estimated wait time based on current queue and agent availability
 */
async function calculateEstimatedWaitTime(siteId, queuePosition) {
  try {
    // Get available agents count
    const agentsResult = await query(`
      SELECT COUNT(*) as count
      FROM users u
      JOIN agents_presence ap ON u.id = ap.agent_id
      WHERE (u.site_id = $1 OR u.site_id IS NULL)
        AND ap.status = 'online'
        AND u.current_chats < u.max_chats
    `, [siteId]);

    const availableAgents = parseInt(agentsResult.rows[0].count) || 1;

    // Get average chat duration from last 50 conversations
    const avgDurationResult = await query(`
      SELECT AVG(
        EXTRACT(EPOCH FROM (closed_at - created_at)) / 60
      ) as avg_minutes
      FROM conversations
      WHERE site_id = $1 
        AND closed_at IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      LIMIT 50
    `, [siteId]);

    const avgChatMinutes = parseFloat(avgDurationResult.rows[0].avg_minutes) || 5;

    // Calculate: (queue position / available agents) * average chat duration
    const estimatedWait = Math.ceil((queuePosition / availableAgents) * avgChatMinutes);

    return Math.max(1, estimatedWait); // Minimum 1 minute

  } catch (error) {
    logger.error('CalculateEstimatedWaitTime error:', error);
    return 5; // Default 5 minutes
  }
}

/**
 * Get queue status for a conversation
 */
async function getQueueStatus(conversationId) {
  try {
    const result = await query(
      'SELECT * FROM chat_queue WHERE conversation_id = $1 AND status = $2',
      [conversationId, 'waiting']
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];

  } catch (error) {
    logger.error('GetQueueStatus error:', error);
    return null;
  }
}

/**
 * Update queue positions after someone leaves queue
 */
async function updateQueuePositions(siteId) {
  try {
    // Get all waiting queue entries sorted by priority and entered_at
    const queueEntries = await query(`
      SELECT id
      FROM chat_queue
      WHERE site_id = $1 AND status = 'waiting'
      ORDER BY priority DESC, entered_at ASC
    `, [siteId]);

    // Update positions
    for (let i = 0; i < queueEntries.rows.length; i++) {
      const newPosition = i + 1;
      const estimatedWait = await calculateEstimatedWaitTime(siteId, newPosition);

      await query(`
        UPDATE chat_queue
        SET queue_position = $1, estimated_wait_minutes = $2
        WHERE id = $3
      `, [newPosition, estimatedWait, queueEntries.rows[i].id]);

      // Notify visitor about position change
      const queueEntry = await query(
        'SELECT conversation_id FROM chat_queue WHERE id = $1',
        [queueEntries.rows[i].id]
      );

      if (queueEntry.rows.length > 0) {
        const io = global.socketIO;
        if (io) {
          io.to(`conv:${queueEntry.rows[0].conversation_id}`).emit('queue:position_updated', {
            position: newPosition,
            estimatedWaitMinutes: estimatedWait
          });
        }
      }
    }

    logger.info(`Updated queue positions for site: ${siteId}`);

  } catch (error) {
    logger.error('UpdateQueuePositions error:', error);
  }
}

/**
 * Remove from queue (assigned or cancelled)
 */
async function removeFromQueue(conversationId, status = 'assigned') {
  try {
    const result = await query(`
      UPDATE chat_queue
      SET status = $1, assigned_at = NOW()
      WHERE conversation_id = $2 AND status = 'waiting'
      RETURNING site_id
    `, [status, conversationId]);

    if (result.rows.length > 0) {
      const siteId = result.rows[0].site_id;
      logger.info(`Removed from queue - Conversation: ${conversationId}, Status: ${status}`);
      
      // Update all queue positions
      await updateQueuePositions(siteId);
    }

  } catch (error) {
    logger.error('RemoveFromQueue error:', error);
  }
}

/**
 * Get next conversation from queue for agent assignment
 */
async function getNextFromQueue(siteId, agentSkills = [], agentDepartmentId = null) {
  try {
    let query_str = `
      SELECT cq.*, c.visitor_id
      FROM chat_queue cq
      JOIN conversations c ON cq.conversation_id = c.id
      WHERE cq.site_id = $1 
        AND cq.status = 'waiting'
        AND cq.timeout_at > NOW()
    `;

    const params = [siteId];

    // Skill-based filtering (if agent has skills and queue entry requires skills)
    if (agentSkills.length > 0) {
      query_str += ` AND (cq.required_skills IS NULL OR cq.required_skills && $${params.length + 1})`;
      params.push(agentSkills);
    }

    // Department filtering
    if (agentDepartmentId) {
      query_str += ` AND (cq.preferred_department_id IS NULL OR cq.preferred_department_id = $${params.length + 1})`;
      params.push(agentDepartmentId);
    }

    query_str += ` ORDER BY cq.priority DESC, cq.entered_at ASC LIMIT 1`;

    const result = await query(query_str, params);

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return null;

  } catch (error) {
    logger.error('GetNextFromQueue error:', error);
    return null;
  }
}

/**
 * Check and handle queue timeouts
 */
async function handleQueueTimeouts() {
  try {
    const timedOut = await query(`
      SELECT cq.*, c.visitor_id
      FROM chat_queue cq
      JOIN conversations c ON cq.conversation_id = c.id
      WHERE cq.status = 'waiting' 
        AND cq.timeout_at < NOW()
    `);

    for (const entry of timedOut.rows) {
      // Mark as timeout
      await query(
        'UPDATE chat_queue SET status = $1 WHERE id = $2',
        ['timeout', entry.id]
      );

      // Close conversation
      await query(
        'UPDATE conversations SET status = $1 WHERE id = $2',
        ['closed', entry.conversation_id]
      );

      // Notify visitor
      const io = global.socketIO;
      if (io) {
        io.to(`conv:${entry.conversation_id}`).emit('queue:timeout', {
          message: 'Maalesef tüm temsilcilerimiz meşgul. Lütfen daha sonra tekrar deneyin.'
        });
      }

      logger.info(`Queue timeout - Conversation: ${entry.conversation_id}`);
    }

    if (timedOut.rows.length > 0) {
      logger.info(`Handled ${timedOut.rows.length} queue timeouts`);
    }

  } catch (error) {
    logger.error('HandleQueueTimeouts error:', error);
  }
}

// Run timeout check every minute
setInterval(handleQueueTimeouts, 60000);

module.exports = {
  addToQueue,
  getQueueStatus,
  removeFromQueue,
  getNextFromQueue,
  updateQueuePositions,
  calculateEstimatedWaitTime,
  handleQueueTimeouts
};

