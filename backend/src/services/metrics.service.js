/**
 * Metrics Service
 * Tracks chat performance metrics (response times, resolution times, CSAT)
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Calculate and save metrics for a conversation
 */
async function calculateConversationMetrics(conversationId) {
  try {
    // Get conversation details
    const convResult = await query(`
      SELECT c.*, 
             COUNT(m.id) as message_count,
             MIN(CASE WHEN m.sender_type = 'agent' THEN m.created_at END) as first_agent_response,
             c.created_at as conversation_start,
             c.closed_at as conversation_end
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [conversationId]);

    if (convResult.rows.length === 0) {
      return null;
    }

    const conv = convResult.rows[0];

    // Calculate first response time (seconds)
    let firstResponseTime = null;
    if (conv.first_agent_response) {
      firstResponseTime = Math.floor(
        (new Date(conv.first_agent_response) - new Date(conv.conversation_start)) / 1000
      );
    }

    // Calculate resolution time (seconds)
    let resolutionTime = null;
    if (conv.conversation_end) {
      resolutionTime = Math.floor(
        (new Date(conv.conversation_end) - new Date(conv.conversation_start)) / 1000
      );
    }

    // Calculate average response time
    const avgResponseTime = await calculateAverageResponseTime(conversationId);

    // Save or update metrics
    await query(`
      INSERT INTO chat_metrics (
        conversation_id, 
        agent_id, 
        first_response_time_seconds,
        avg_response_time_seconds,
        resolution_time_seconds,
        total_messages
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (conversation_id) 
      DO UPDATE SET
        first_response_time_seconds = EXCLUDED.first_response_time_seconds,
        avg_response_time_seconds = EXCLUDED.avg_response_time_seconds,
        resolution_time_seconds = EXCLUDED.resolution_time_seconds,
        total_messages = EXCLUDED.total_messages
    `, [
      conversationId,
      conv.agent_id,
      firstResponseTime,
      avgResponseTime,
      resolutionTime,
      conv.message_count
    ]);

    logger.info(`Metrics calculated for conversation: ${conversationId}`);

    return {
      firstResponseTime,
      avgResponseTime,
      resolutionTime,
      totalMessages: conv.message_count
    };

  } catch (error) {
    logger.error('CalculateConversationMetrics error:', error);
    return null;
  }
}

/**
 * Calculate average response time for agent messages
 */
async function calculateAverageResponseTime(conversationId) {
  try {
    const result = await query(`
      WITH message_pairs AS (
        SELECT 
          m1.created_at as visitor_time,
          MIN(m2.created_at) as agent_time
        FROM messages m1
        LEFT JOIN messages m2 ON m2.conversation_id = m1.conversation_id
          AND m2.sender_type = 'agent'
          AND m2.created_at > m1.created_at
        WHERE m1.conversation_id = $1
          AND m1.sender_type = 'visitor'
        GROUP BY m1.id, m1.created_at
      )
      SELECT AVG(EXTRACT(EPOCH FROM (agent_time - visitor_time))) as avg_seconds
      FROM message_pairs
      WHERE agent_time IS NOT NULL
    `, [conversationId]);

    return result.rows[0].avg_seconds ? Math.floor(result.rows[0].avg_seconds) : null;

  } catch (error) {
    logger.error('CalculateAverageResponseTime error:', error);
    return null;
  }
}

/**
 * Save customer satisfaction score
 */
async function saveCSATScore(conversationId, score) {
  try {
    await query(`
      UPDATE chat_metrics
      SET customer_satisfaction_score = $1
      WHERE conversation_id = $2
    `, [score, conversationId]);

    logger.info(`CSAT score ${score} saved for conversation: ${conversationId}`);

    return true;

  } catch (error) {
    logger.error('SaveCSATScore error:', error);
    return false;
  }
}

/**
 * Get agent performance metrics
 */
async function getAgentPerformanceMetrics(agentId, startDate, endDate) {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_conversations,
        AVG(first_response_time_seconds) as avg_first_response_time,
        AVG(avg_response_time_seconds) as avg_response_time,
        AVG(resolution_time_seconds) as avg_resolution_time,
        AVG(customer_satisfaction_score) as avg_csat,
        SUM(total_messages) as total_messages
      FROM chat_metrics
      WHERE agent_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `, [agentId, startDate, endDate]);

    return result.rows[0];

  } catch (error) {
    logger.error('GetAgentPerformanceMetrics error:', error);
    return null;
  }
}

/**
 * Get site performance metrics
 */
async function getSitePerformanceMetrics(siteId, startDate, endDate) {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_conversations,
        AVG(cm.first_response_time_seconds) as avg_first_response_time,
        AVG(cm.avg_response_time_seconds) as avg_response_time,
        AVG(cm.resolution_time_seconds) as avg_resolution_time,
        AVG(cm.customer_satisfaction_score) as avg_csat,
        SUM(cm.total_messages) as total_messages
      FROM chat_metrics cm
      JOIN conversations c ON cm.conversation_id = c.id
      WHERE c.site_id = $1
        AND cm.created_at >= $2
        AND cm.created_at <= $3
    `, [siteId, startDate, endDate]);

    return result.rows[0];

  } catch (error) {
    logger.error('GetSitePerformanceMetrics error:', error);
    return null;
  }
}

module.exports = {
  calculateConversationMetrics,
  calculateAverageResponseTime,
  saveCSATScore,
  getAgentPerformanceMetrics,
  getSitePerformanceMetrics
};







