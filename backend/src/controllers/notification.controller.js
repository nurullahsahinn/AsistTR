/**
 * Notification Controller
 * Manages notification preferences and push subscriptions
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Get notification preferences
async function getPreferences(req, res) {
  try {
    const userId = req.user.id;
    
    let result = await query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Create default preferences
      result = await query(`
        INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `, [userId]);
    }
    
    res.json({ preferences: result.rows[0] });
    
  } catch (error) {
    logger.error('GetPreferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
}

// Update notification preferences
async function updatePreferences(req, res) {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    const allowedFields = [
      'email_new_conversation', 'email_new_message', 'email_conversation_assigned', 'email_daily_summary',
      'browser_new_conversation', 'browser_new_message', 'browser_conversation_assigned',
      'sound_enabled', 'sound_volume', 'desktop_enabled'
    ];
    
    const setValues = [];
    const params = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setValues.push(`${key} = $${paramCount++}`);
        params.push(updates[key]);
      }
    });
    
    if (setValues.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    setValues.push(`updated_at = NOW()`);
    params.push(userId);
    
    const result = await query(`
      UPDATE notification_preferences
      SET ${setValues.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `, params);
    
    logger.info(`Notification preferences updated for user: ${userId}`);
    
    res.json({
      message: 'Preferences updated successfully',
      preferences: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdatePreferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}

// Subscribe to push notifications
async function subscribePush(req, res) {
  try {
    const userId = req.user.id;
    const { endpoint, keys } = req.body;
    
    if (!endpoint || !keys) {
      return res.status(400).json({ error: 'Endpoint and keys are required' });
    }
    
    const userAgent = req.headers['user-agent'];
    
    // Check if subscription already exists
    const existing = await query(
      'SELECT * FROM push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );
    
    if (existing.rows.length > 0) {
      // Update existing subscription
      const result = await query(`
        UPDATE push_subscriptions
        SET user_id = $1, keys = $2, is_active = true, last_used_at = NOW()
        WHERE endpoint = $3
        RETURNING *
      `, [userId, JSON.stringify(keys), endpoint]);
      
      return res.json({
        message: 'Push subscription updated',
        subscription: result.rows[0]
      });
    }
    
    // Create new subscription
    const result = await query(`
      INSERT INTO push_subscriptions (user_id, endpoint, keys, user_agent)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, endpoint, JSON.stringify(keys), userAgent]);
    
    logger.info(`Push subscription created for user: ${userId}`);
    
    res.status(201).json({
      message: 'Push subscription created',
      subscription: result.rows[0]
    });
    
  } catch (error) {
    logger.error('SubscribePush error:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
}

// Unsubscribe from push notifications
async function unsubscribePush(req, res) {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }
    
    await query(
      'UPDATE push_subscriptions SET is_active = false WHERE endpoint = $1',
      [endpoint]
    );
    
    logger.info(`Push subscription deactivated: ${endpoint}`);
    
    res.json({ message: 'Push subscription deactivated' });
    
  } catch (error) {
    logger.error('UnsubscribePush error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
}

// Get notification history
async function getNotificationHistory(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await query(`
      SELECT * FROM notification_logs
      WHERE user_id = $1
      ORDER BY sent_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const countResult = await query(
      'SELECT COUNT(*) as total FROM notification_logs WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    logger.error('GetNotificationHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
}

// Get unread count
async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;
    
    // This is a placeholder - you might want to add a read/unread status to notifications
    res.json({ unread: 0 });
    
  } catch (error) {
    logger.error('GetUnreadCount error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}

module.exports = {
  getPreferences,
  updatePreferences,
  subscribePush,
  unsubscribePush,
  getNotificationHistory,
  getUnreadCount
};
