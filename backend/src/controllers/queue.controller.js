/**
 * Queue Controller
 * Chat queue monitoring and management
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Get current queue status
 */
async function getQueueStatus(req, res) {
  try {
    const { siteId } = req.query;
    
    // Get queue items
    let queueQuery = `
      SELECT 
        cq.*,
        v.name as visitor_name,
        c.id as conversation_id
      FROM chat_queue cq
      LEFT JOIN visitors v ON cq.visitor_id = v.id
      LEFT JOIN conversations c ON cq.conversation_id = c.id
      WHERE cq.status = 'waiting'
    `;
    
    const params = [];
    if (siteId) {
      queueQuery += ` AND cq.site_id = $1`;
      params.push(siteId);
    }
    
    queueQuery += ` ORDER BY cq.priority DESC, cq.entered_at ASC`;
    
    const queueItems = await query(queueQuery, params);
    
    // Calculate summary stats
    const summary = {
      waiting: queueItems.rows.length,
      averageWaitTime: 0,
      longestWait: 0,
      vipInQueue: 0
    };
    
    if (queueItems.rows.length > 0) {
      const now = new Date();
      let totalWait = 0;
      let maxWait = 0;
      
      queueItems.rows.forEach(item => {
        const waitTime = Math.floor((now - new Date(item.entered_at)) / 60000); // minutes
        totalWait += waitTime;
        maxWait = Math.max(maxWait, waitTime);
        
        if (item.priority > 0) {
          summary.vipInQueue++;
        }
      });
      
      summary.averageWaitTime = Math.floor(totalWait / queueItems.rows.length);
      summary.longestWait = maxWait;
    }
    
    res.json({
      summary,
      items: queueItems.rows
    });
    
  } catch (error) {
    logger.error('GetQueueStatus error:', error);
    res.status(500).json({ error: 'Failed to fetch queue status' });
  }
}

/**
 * Remove item from queue manually (admin)
 */
async function removeFromQueue(req, res) {
  try {
    const { queueId } = req.params;
    
    await query(`
      UPDATE chat_queue
      SET status = 'cancelled', removed_at = NOW()
      WHERE id = $1
    `, [queueId]);
    
    logger.info(`Queue item ${queueId} removed manually`);
    
    res.json({
      message: 'Item removed from queue'
    });
    
  } catch (error) {
    logger.error('RemoveFromQueue error:', error);
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
}

/**
 * Get queue statistics
 */
async function getQueueStats(req, res) {
  try {
    const { siteId, period = '7d' } = req.query;
    
    // Calculate date range
    const daysAgo = parseInt(period.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    let statsQuery = `
      SELECT 
        COUNT(*) as total_queued,
        AVG(EXTRACT(EPOCH FROM (removed_at - entered_at)) / 60) as avg_wait_minutes,
        MAX(EXTRACT(EPOCH FROM (removed_at - entered_at)) / 60) as max_wait_minutes,
        COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
        COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout
      FROM chat_queue
      WHERE entered_at >= $1
    `;
    
    const params = [startDate];
    
    if (siteId) {
      statsQuery += ` AND site_id = $2`;
      params.push(siteId);
    }
    
    const stats = await query(statsQuery, params);
    
    res.json({
      period,
      stats: stats.rows[0]
    });
    
  } catch (error) {
    logger.error('GetQueueStats error:', error);
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
}

module.exports = {
  getQueueStatus,
  removeFromQueue,
  getQueueStats
};


