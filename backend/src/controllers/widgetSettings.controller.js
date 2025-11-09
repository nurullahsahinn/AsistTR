/**
 * Widget Settings Controller
 * Manages widget appearance and behavior customization
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Get widget settings
async function getWidgetSettings(req, res) {
  try {
    const { siteId } = req.query;
    
    if (!siteId) {
      return res.status(400).json({ error: 'Site ID required' });
    }
    
    let result = await query(
      'SELECT * FROM widget_settings WHERE site_id = $1',
      [siteId]
    );
    
    if (result.rows.length === 0) {
      // Create default settings if not exists
      const createResult = await query(`
        INSERT INTO widget_settings (site_id)
        VALUES ($1)
        RETURNING *
      `, [siteId]);
      
      return res.json({ settings: createResult.rows[0] });
    }
    
    res.json({ settings: result.rows[0] });
    
  } catch (error) {
    logger.error('GetWidgetSettings error:', error);
    res.status(500).json({ error: 'Failed to fetch widget settings' });
  }
}

// Update widget settings
async function updateWidgetSettings(req, res) {
  try {
    const { siteId } = req.params;
    const updates = req.body;
    
    // Build update query dynamically
    const allowedFields = [
      'primary_color', 'secondary_color', 'text_color', 'position',
      'widget_title', 'welcome_message', 'offline_message', 'placeholder_text',
      'enable_pre_chat_form', 'pre_chat_name_required', 'pre_chat_email_required',
      'pre_chat_phone_required', 'pre_chat_message_required',
      'enable_business_hours', 'business_hours', 'timezone',
      'language', 'auto_show_delay', 'show_agent_avatars',
      'show_typing_indicator', 'sound_notifications', 'show_branding', 'custom_css'
    ];
    
    const setValues = [];
    const params = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setValues.push(`${key} = $${paramCount}`);
        params.push(updates[key]);
        paramCount++;
      }
    });
    
    if (setValues.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    setValues.push(`updated_at = NOW()`);
    params.push(siteId);
    
    const result = await query(`
      UPDATE widget_settings
      SET ${setValues.join(', ')}
      WHERE site_id = $${paramCount}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Widget settings not found' });
    }
    
    logger.info(`Widget settings updated for site: ${siteId}`);
    
    res.json({
      message: 'Widget settings updated successfully',
      settings: result.rows[0]
    });
    
  } catch (error) {
    logger.error('UpdateWidgetSettings error:', error);
    res.status(500).json({ error: 'Failed to update widget settings' });
  }
}

// Get public widget config (for widget.js to load)
async function getPublicWidgetConfig(req, res) {
  try {
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Get site by API key
    const siteResult = await query(
      'SELECT id FROM sites WHERE api_key = $1 AND is_active = true',
      [apiKey]
    );
    
    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid API key' });
    }
    
    const siteId = siteResult.rows[0].id;
    
    // Get widget settings
    const settingsResult = await query(
      'SELECT * FROM widget_settings WHERE site_id = $1',
      [siteId]
    );
    
    let settings = settingsResult.rows[0];
    
    // Create default if not exists
    if (!settings) {
      const createResult = await query(`
        INSERT INTO widget_settings (site_id)
        VALUES ($1)
        RETURNING *
      `, [siteId]);
      settings = createResult.rows[0];
    }
    
    // Return public settings (exclude internal fields)
    const publicSettings = {
      primaryColor: settings.primary_color,
      secondaryColor: settings.secondary_color,
      textColor: settings.text_color,
      position: settings.position,
      widgetTitle: settings.widget_title,
      welcomeMessage: settings.welcome_message,
      offlineMessage: settings.offline_message,
      placeholderText: settings.placeholder_text,
      enablePreChatForm: settings.enable_pre_chat_form,
      preChatNameRequired: settings.pre_chat_name_required,
      preChatEmailRequired: settings.pre_chat_email_required,
      preChatPhoneRequired: settings.pre_chat_phone_required,
      preChatMessageRequired: settings.pre_chat_message_required,
      enableBusinessHours: settings.enable_business_hours,
      businessHours: settings.business_hours,
      timezone: settings.timezone,
      language: settings.language,
      autoShowDelay: settings.auto_show_delay,
      showAgentAvatars: settings.show_agent_avatars,
      showTypingIndicator: settings.show_typing_indicator,
      soundNotifications: settings.sound_notifications,
      showBranding: settings.show_branding,
      customCss: settings.custom_css
    };
    
    res.json({ settings: publicSettings });
    
  } catch (error) {
    logger.error('GetPublicWidgetConfig error:', error);
    res.status(500).json({ error: 'Failed to fetch widget config' });
  }
}

// Check if currently within business hours
async function isWithinBusinessHours(req, res) {
  try {
    const { siteId } = req.query;
    
    if (!siteId) {
      return res.status(400).json({ error: 'Site ID required' });
    }
    
    const result = await query(
      'SELECT enable_business_hours, business_hours, timezone FROM widget_settings WHERE site_id = $1',
      [siteId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].enable_business_hours) {
      return res.json({ isOpen: true, message: 'Always available' });
    }
    
    const settings = result.rows[0];
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    
    const daySchedule = settings.business_hours[currentDay];
    
    if (!daySchedule || !daySchedule.enabled) {
      return res.json({ 
        isOpen: false, 
        message: 'We are currently closed',
        nextAvailable: getNextAvailableTime(settings.business_hours, currentDay)
      });
    }
    
    // Check current time
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (currentTime >= daySchedule.start && currentTime < daySchedule.end) {
      return res.json({ 
        isOpen: true, 
        message: 'We are online',
        closesAt: daySchedule.end
      });
    }
    
    res.json({ 
      isOpen: false, 
      message: 'We are currently closed',
      opensAt: daySchedule.start,
      nextAvailable: getNextAvailableTime(settings.business_hours, currentDay)
    });
    
  } catch (error) {
    logger.error('IsWithinBusinessHours error:', error);
    res.status(500).json({ error: 'Failed to check business hours' });
  }
}

// Helper function to get next available time
function getNextAvailableTime(businessHours, currentDay) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayIndex = dayNames.indexOf(currentDay);
  
  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDay = dayNames[nextDayIndex];
    const schedule = businessHours[nextDay];
    
    if (schedule && schedule.enabled) {
      return {
        day: nextDay,
        time: schedule.start
      };
    }
  }
  
  return null;
}

module.exports = {
  getWidgetSettings,
  updateWidgetSettings,
  getPublicWidgetConfig,
  isWithinBusinessHours
};
