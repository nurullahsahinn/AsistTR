/**
 * Visitor Tracking Service
 * Handles visitor identification, session management, and page tracking
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Parse user agent to extract browser, OS, device info
function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device_type: 'Unknown' };
  
  // Browser detection
  let browser = 'Unknown';
  let browser_version = '';
  if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
    browser_version = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '';
  } else if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
    browser_version = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || '';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    browser_version = userAgent.match(/Version\/([\d.]+)/)?.[1] || '';
  } else if (userAgent.includes('Edge/')) {
    browser = 'Edge';
    browser_version = userAgent.match(/Edge\/([\d.]+)/)?.[1] || '';
  }
  
  // OS detection
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS X')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  // Device type detection
  let device_type = 'Desktop';
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) device_type = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device_type = 'Tablet';
  
  return { browser, browser_version, os, device_type };
}

// Track or update visitor
async function trackVisitor(visitorData) {
  const { 
    visitor_id, 
    site_id, 
    name, 
    email, 
    ip_address, 
    user_agent,
    session_id 
  } = visitorData;
  
  try {
    const deviceInfo = parseUserAgent(user_agent);
    
    // Check if visitor exists
    let visitor;
    if (visitor_id) {
      const result = await query('SELECT * FROM visitors WHERE id = $1', [visitor_id]);
      visitor = result.rows[0];
    }
    
    if (visitor) {
      // Update existing visitor
      await query(`
        UPDATE visitors 
        SET last_seen = NOW(), 
            visit_count = visit_count + 1,
            is_online = true,
            ip_address = COALESCE($1, ip_address),
            browser = COALESCE($2, browser),
            browser_version = COALESCE($3, browser_version),
            os = COALESCE($4, os),
            device_type = COALESCE($5, device_type),
            user_agent = COALESCE($6, user_agent)
        WHERE id = $7
      `, [ip_address, deviceInfo.browser, deviceInfo.browser_version, deviceInfo.os, deviceInfo.device_type, user_agent, visitor_id]);
      
      logger.info(`Visitor updated: ${visitor_id}`);
      return visitor;
    } else {
      // Create new visitor
      const result = await query(`
        INSERT INTO visitors (
          site_id, name, email, ip_address, 
          browser, browser_version, os, device_type, user_agent,
          first_seen, last_seen, visit_count, is_online
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), 1, true)
        RETURNING *
      `, [
        site_id, name || 'Anonymous', email, ip_address,
        deviceInfo.browser, deviceInfo.browser_version, deviceInfo.os, deviceInfo.device_type, user_agent
      ]);
      
      visitor = result.rows[0];
      logger.info(`New visitor created: ${visitor.id}`);
      return visitor;
    }
  } catch (error) {
    logger.error('TrackVisitor error:', error);
    throw error;
  }
}

// Create or get session
async function trackSession(sessionData) {
  const { session_id, visitor_id, site_id, referrer, landing_page } = sessionData;
  
  try {
    // Check if session exists
    const existing = await query(
      'SELECT * FROM visitor_sessions WHERE session_id = $1',
      [session_id]
    );
    
    if (existing.rows.length > 0) {
      // Update session
      await query(
        'UPDATE visitor_sessions SET is_active = true WHERE session_id = $1',
        [session_id]
      );
      return existing.rows[0];
    }
    
    // Create new session
    const result = await query(`
      INSERT INTO visitor_sessions (
        session_id, visitor_id, site_id, referrer, landing_page, started_at, is_active
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), true)
      RETURNING *
    `, [session_id, visitor_id, site_id, referrer, landing_page]);
    
    logger.info(`New session created: ${session_id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('TrackSession error:', error);
    throw error;
  }
}

// Track page view
async function trackPageView(pageData) {
  const { session_id, visitor_id, site_id, page_url, page_title, referrer } = pageData;
  
  try {
    // Insert page view
    const result = await query(`
      INSERT INTO page_views (
        session_id, visitor_id, site_id, page_url, page_title, referrer, viewed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [session_id, visitor_id, site_id, page_url, page_title, referrer]);
    
    // Update session page views count
    await query(
      'UPDATE visitor_sessions SET page_views = page_views + 1 WHERE session_id = $1',
      [session_id]
    );
    
    // Update session exit page
    await query(
      'UPDATE visitor_sessions SET exit_page = $1 WHERE session_id = $2',
      [page_url, session_id]
    );
    
    logger.info(`Page view tracked: ${page_url}`);
    return result.rows[0];
  } catch (error) {
    logger.error('TrackPageView error:', error);
    throw error;
  }
}

// Track visitor event
async function trackEvent(eventData) {
  const { visitor_id, session_id, site_id, event_type, event_data } = eventData;
  
  try {
    const result = await query(`
      INSERT INTO visitor_events (
        visitor_id, session_id, site_id, event_type, event_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [visitor_id, session_id, site_id, event_type, JSON.stringify(event_data)]);
    
    logger.info(`Event tracked: ${event_type}`);
    return result.rows[0];
  } catch (error) {
    logger.error('TrackEvent error:', error);
    throw error;
  }
}

// End session
async function endSession(session_id) {
  try {
    const result = await query(`
      UPDATE visitor_sessions 
      SET ended_at = NOW(),
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
          is_active = false
      WHERE session_id = $1
      RETURNING *
    `, [session_id]);
    
    if (result.rows.length > 0) {
      logger.info(`Session ended: ${session_id}`);
    }
    return result.rows[0];
  } catch (error) {
    logger.error('EndSession error:', error);
    throw error;
  }
}

// Set visitor offline
async function setVisitorOffline(visitor_id) {
  try {
    await query(
      'UPDATE visitors SET is_online = false, last_seen = NOW() WHERE id = $1',
      [visitor_id]
    );
    logger.info(`Visitor offline: ${visitor_id}`);
  } catch (error) {
    logger.error('SetVisitorOffline error:', error);
  }
}

// Get online visitors
async function getOnlineVisitors(site_id) {
  try {
    const result = await query(`
      SELECT 
        v.id, v.site_id, v.name, v.email, v.ip_address, v.user_agent, 
        v.meta, v.first_seen, v.last_seen, v.device_type, v.browser, v.os, 
        v.is_online, v.created_at,
        vs.session_id as visitor_session_id,
        vs.started_at as session_started,
        vs.page_views,
        (SELECT pv.page_url FROM page_views pv WHERE pv.session_id = vs.id ORDER BY pv.viewed_at DESC LIMIT 1) as current_page
      FROM visitors v
      LEFT JOIN visitor_sessions vs ON v.id = vs.visitor_id AND vs.is_active = true
      WHERE v.site_id = $1 AND v.is_online = true
      ORDER BY v.last_seen DESC
    `, [site_id]);
    
    return result.rows;
  } catch (error) {
    logger.error('GetOnlineVisitors error:', error);
    return [];
  }
}

// Get visitor journey
async function getVisitorJourney(visitor_id, limit = 50) {
  try {
    const result = await query(`
      SELECT 
        pv.*,
        vs.session_id,
        vs.started_at as session_started
      FROM page_views pv
      JOIN visitor_sessions vs ON pv.session_id = vs.id
      WHERE pv.visitor_id = $1
      ORDER BY pv.viewed_at DESC
      LIMIT $2
    `, [visitor_id, limit]);
    
    return result.rows;
  } catch (error) {
    logger.error('GetVisitorJourney error:', error);
    return [];
  }
}

module.exports = {
  trackVisitor,
  trackSession,
  trackPageView,
  trackEvent,
  endSession,
  setVisitorOffline,
  getOnlineVisitors,
  getVisitorJourney,
  parseUserAgent
};
