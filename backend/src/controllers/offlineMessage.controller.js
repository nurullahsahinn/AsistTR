/**
 * Offline Message Controller
 * Handles messages submitted when agents are offline
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Submit offline message (public endpoint)
 */
async function submitOfflineMessage(req, res) {
  try {
    const { apiKey, name, email, phone, departmentId, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Get site by API key
    const siteResult = await query(
      'SELECT id FROM sites WHERE api_key = $1',
      [apiKey]
    );

    if (siteResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const siteId = siteResult.rows[0].id;

    // Save offline message
    const result = await query(`
      INSERT INTO offline_messages (site_id, name, email, phone, department_id, message)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [siteId, name, email, phone, departmentId, message]);

    logger.info(`Offline message received from ${email}`);

    // Notify admins via Socket.IO
    const io = global.socketIO;
    if (io) {
      io.to(`site:${siteId}:agents`).emit('offline:message:new', {
        id: result.rows[0].id,
        name,
        email,
        message: message.substring(0, 100) + '...'
      });
    }

    res.json({
      success: true,
      message: 'Mesajınız alındı. En kısa sürede size dönüş yapacağız.'
    });

  } catch (error) {
    logger.error('SubmitOfflineMessage error:', error);
    res.status(500).json({ error: 'Failed to submit message' });
  }
}

/**
 * Get offline messages (admin)
 */
async function getOfflineMessages(req, res) {
  try {
    const { siteId, status = 'pending' } = req.query;

    let query_str = 'SELECT * FROM offline_messages WHERE 1=1';
    const params = [];

    if (siteId) {
      params.push(siteId);
      query_str += ` AND site_id = $${params.length}`;
    }

    if (status !== 'all') {
      params.push(status);
      query_str += ` AND status = $${params.length}`;
    }

    query_str += ' ORDER BY created_at DESC LIMIT 100';

    const result = await query(query_str, params);

    res.json({
      messages: result.rows
    });

  } catch (error) {
    logger.error('GetOfflineMessages error:', error);
    res.status(500).json({ error: 'Failed to fetch offline messages' });
  }
}

/**
 * Update offline message status
 */
async function updateMessageStatus(req, res) {
  try {
    const { messageId } = req.params;
    const { status } = req.body; // 'pending', 'contacted', 'resolved'

    const result = await query(`
      UPDATE offline_messages
      SET status = $1, contacted_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, messageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    logger.info(`Offline message ${messageId} status updated to: ${status}`);

    res.json({
      message: 'Status updated',
      offlineMessage: result.rows[0]
    });

  } catch (error) {
    logger.error('UpdateMessageStatus error:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
}

/**
 * Delete offline message
 */
async function deleteOfflineMessage(req, res) {
  try {
    const { messageId } = req.params;

    await query('DELETE FROM offline_messages WHERE id = $1', [messageId]);

    logger.info(`Offline message ${messageId} deleted`);

    res.json({
      message: 'Message deleted successfully'
    });

  } catch (error) {
    logger.error('DeleteOfflineMessage error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}

module.exports = {
  submitOfflineMessage,
  getOfflineMessages,
  updateMessageStatus,
  deleteOfflineMessage
};

