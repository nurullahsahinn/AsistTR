/**
 * Notification Service
 * Handles sending notifications via multiple channels
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Send notification to user
async function sendNotification(userId, notification) {
  const { type, title, message, data = {} } = notification;
  
  try {
    // Get user preferences
    const prefsResult = await query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    
    if (prefsResult.rows.length === 0) {
      logger.warn(`No notification preferences found for user: ${userId}`);
      return;
    }
    
    const prefs = prefsResult.rows[0];
    const results = [];
    
    // Determine which channels to use based on notification type
    const channels = getChannelsForNotification(type, prefs);
    
    // Send via each enabled channel
    for (const channel of channels) {
      try {
        let result;
        
        switch (channel) {
          case 'browser':
            result = await sendBrowserNotification(userId, { title, message, data });
            break;
          case 'email':
            result = await sendEmailNotification(userId, { type, title, message, data });
            break;
          case 'desktop':
            result = await sendDesktopNotification(userId, { title, message, data });
            break;
        }
        
        results.push({ channel, status: 'sent', ...result });
        
        // Log notification
        await logNotification(userId, type, channel, title, message, data, 'sent');
        
      } catch (error) {
        logger.error(`Failed to send ${channel} notification:`, error);
        results.push({ channel, status: 'failed', error: error.message });
        
        await logNotification(userId, type, channel, title, message, data, 'failed', error.message);
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('SendNotification error:', error);
    throw error;
  }
}

// Determine channels based on notification type and preferences
function getChannelsForNotification(type, prefs) {
  const channels = [];
  
  // Map notification types to preference fields
  const typeMap = {
    'new_conversation': {
      browser: prefs.browser_new_conversation,
      email: prefs.email_new_conversation,
      desktop: prefs.desktop_enabled
    },
    'new_message': {
      browser: prefs.browser_new_message,
      email: prefs.email_new_message,
      desktop: prefs.desktop_enabled
    },
    'conversation_assigned': {
      browser: prefs.browser_conversation_assigned,
      email: prefs.email_conversation_assigned,
      desktop: prefs.desktop_enabled
    },
    'chat_transferred': {
      browser: true,
      email: false,
      desktop: prefs.desktop_enabled
    }
  };
  
  const mapping = typeMap[type] || {};
  
  if (mapping.browser) channels.push('browser');
  if (mapping.email) channels.push('email');
  if (mapping.desktop) channels.push('desktop');
  
  return channels;
}

// Send browser push notification
async function sendBrowserNotification(userId, notification) {
  const { title, message, data } = notification;
  
  // Get active push subscriptions for user
  const subsResult = await query(
    'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  
  if (subsResult.rows.length === 0) {
    return { delivered: 0, message: 'No active subscriptions' };
  }
  
  const webpush = require('web-push');
  
  // Configure web-push (these should be in env variables)
  const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
  };
  
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    logger.warn('VAPID keys not configured, skipping browser notifications');
    return { delivered: 0, message: 'VAPID keys not configured' };
  }
  
  webpush.setVapidDetails(
    'mailto:support@asistr.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  
  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/icon.png',
    badge: '/badge.png',
    data
  });
  
  let delivered = 0;
  
  for (const subscription of subsResult.rows) {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      };
      
      await webpush.sendNotification(pushSubscription, payload);
      delivered++;
      
      // Update last_used_at
      await query(
        'UPDATE push_subscriptions SET last_used_at = NOW() WHERE id = $1',
        [subscription.id]
      );
      
    } catch (error) {
      logger.error(`Failed to send push to subscription ${subscription.id}:`, error);
      
      // If subscription is invalid, mark as inactive
      if (error.statusCode === 410 || error.statusCode === 404) {
        await query(
          'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
          [subscription.id]
        );
      }
    }
  }
  
  return { delivered, total: subsResult.rows.length };
}

// Send email notification using Nodemailer
async function sendEmailNotification(userId, notification) {
  const { type, title, message, data } = notification;
  
  // Get user email
  const userResult = await query(
    'SELECT email, name FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }
  
  const user = userResult.rows[0];
  
  // Check if email is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@asistr.com';
  
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    logger.warn('SMTP not configured, skipping email notification');
    return { 
      sent: false, 
      recipient: user.email,
      message: 'SMTP not configured'
    };
  }
  
  try {
    const nodemailer = require('nodemailer');
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });
    
    // Email content
    const emailSubject = title || 'AsistTR Bildirimi';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${emailSubject}</h2>
        <p style="color: #374151; line-height: 1.6;">${message}</p>
        ${data.conversationId ? `
          <p style="margin-top: 20px;">
            <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}/chat/${data.conversationId}" 
               style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Sohbeti Görüntüle
            </a>
          </p>
        ` : ''}
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">
          Bu otomatik bir bildirimdir. Lütfen bu e-postaya yanıt vermeyin.
        </p>
      </div>
    `;
    
    // Send email
    const info = await transporter.sendMail({
      from: `"AsistTR" <${smtpFrom}>`,
      to: user.email,
      subject: emailSubject,
      html: emailHtml,
      text: message // Plain text fallback
    });
    
    logger.info(`Email sent to ${user.email}:`, info.messageId);
    
    return { 
      sent: true, 
      recipient: user.email,
      messageId: info.messageId
    };
    
  } catch (error) {
    logger.error('Email sending error:', error);
    throw error;
  }
}

// Send desktop notification (via Socket.IO)
async function sendDesktopNotification(userId, notification) {
  const { title, message, data } = notification;
  
  // Get Socket.IO instance from global
  const io = global.socketIO;
  
  if (!io) {
    return { sent: false, message: 'Socket.IO not available' };
  }
  
  // Emit to user's room
  io.to(`user:${userId}`).emit('notification', {
    title,
    message,
    data,
    timestamp: new Date().toISOString()
  });
  
  return { sent: true };
}

// Log notification
async function logNotification(userId, type, channel, title, message, data, status, errorMessage = null) {
  try {
    await query(`
      INSERT INTO notification_logs (user_id, type, channel, title, message, data, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [userId, type, channel, title, message, JSON.stringify(data), status, errorMessage]);
  } catch (error) {
    logger.error('Failed to log notification:', error);
  }
}

// Helper functions for common notifications
async function notifyNewConversation(agentId, conversation) {
  return sendNotification(agentId, {
    type: 'new_conversation',
    title: 'New Conversation',
    message: `New chat from ${conversation.visitor_name || 'Anonymous'}`,
    data: { conversationId: conversation.id }
  });
}

async function notifyNewMessage(agentId, message, conversation) {
  return sendNotification(agentId, {
    type: 'new_message',
    title: conversation.visitor_name || 'New Message',
    message: message.body.substring(0, 100),
    data: { conversationId: conversation.id, messageId: message.id }
  });
}

async function notifyConversationAssigned(agentId, conversation) {
  return sendNotification(agentId, {
    type: 'conversation_assigned',
    title: 'Chat Assigned',
    message: `You have been assigned a chat with ${conversation.visitor_name || 'Anonymous'}`,
    data: { conversationId: conversation.id }
  });
}

async function notifyChatTransferred(agentId, fromAgent, conversation) {
  return sendNotification(agentId, {
    type: 'chat_transferred',
    title: 'Chat Transferred',
    message: `Chat transferred from ${fromAgent.name}`,
    data: { conversationId: conversation.id }
  });
}

module.exports = {
  sendNotification,
  sendBrowserNotification,
  sendEmailNotification,
  sendDesktopNotification,
  notifyNewConversation,
  notifyNewMessage,
  notifyConversationAssigned,
  notifyChatTransferred
};
