/**
 * Analytics Controller
 * Handles analytics data retrieval and reporting
 */

const { query } = require('../utils/database');
const logger = require('../utils/logger');
const { getOnlineVisitors, getVisitorJourney } = require('../services/visitor.service');

// Track page view (public endpoint)
async function trackPageView(req, res) {
  try {
    const { apiKey, sessionId, url, title, referrer, userAgent, screenResolution, language } = req.body;
    
    // Get site by API key
    const siteResult = await query(
      'SELECT id FROM sites WHERE api_key = $1',
      [apiKey]
    );
    
    if (siteResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const siteId = siteResult.rows[0].id;
    
    // Get or create visitor
    let visitorResult = await query(
      'SELECT id FROM visitors WHERE site_id = $1 AND session_id = $2',
      [siteId, sessionId]
    );
    
    let visitorId;
    
    if (visitorResult.rows.length === 0) {
      // Create new visitor
      const newVisitor = await query(
        `INSERT INTO visitors (site_id, session_id, ip_address, user_agent, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id`,
        [siteId, sessionId, req.ip, userAgent]
      );
      visitorId = newVisitor.rows[0].id;
    } else {
      visitorId = visitorResult.rows[0].id;
      
      // Update last seen
      await query(
        'UPDATE visitors SET last_seen = NOW() WHERE id = $1',
        [visitorId]
      );
    }
    
    // Record page view
    await query(
      `INSERT INTO page_views (visitor_id, site_id, page_url, page_title, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [visitorId, siteId, url, title, referrer]
    );
    
    // Update or create visitor session
    const sessionResult = await query(
      `SELECT id FROM visitor_sessions 
       WHERE visitor_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [visitorId]
    );
    
    if (sessionResult.rows.length === 0) {
      // Create new session
      await query(
        `INSERT INTO visitor_sessions (visitor_id, site_id, session_id, started_at, page_views)
         VALUES ($1, $2, $3, NOW(), 1)`,
        [visitorId, siteId, sessionId]
      );
    } else {
      // Update existing session
      await query(
        `UPDATE visitor_sessions 
         SET page_views = page_views + 1
         WHERE id = $1`,
        [sessionResult.rows[0].id]
      );
    }
    
    res.json({ success: true, visitorId });
    
  } catch (error) {
    logger.error('TrackPageView error:', error);
    res.status(500).json({ error: 'Failed to track page view' });
  }
}

// Get dashboard analytics
async function getDashboardAnalytics(req, res) {
  try {
    const { siteId, period = '7d' } = req.query;
    
    // Calculate date range
    let daysAgo = 7;
    if (period === '24h') daysAgo = 1;
    else if (period === '7d') daysAgo = 7;
    else if (period === '30d') daysAgo = 30;
    else if (period === '90d') daysAgo = 90;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    const params = siteId ? [siteId, startDate] : [startDate];
    const siteFilter = siteId ? 'AND site_id = $1' : '';
    const paramIndex = siteId ? 2 : 1;
    
    // Total visitors
    const visitorsResult = await query(`
      SELECT COUNT(DISTINCT id) as total
      FROM visitors
      WHERE created_at >= $${paramIndex} ${siteFilter}
    `, params);
    
    // New vs Returning
    const newVisitorsResult = await query(`
      SELECT COUNT(*) as count
      FROM visitors
      WHERE first_seen >= $${paramIndex} ${siteFilter}
    `, params);
    
    const returningVisitorsResult = await query(`
      SELECT COUNT(*) as count
      FROM visitors
      WHERE first_seen < $${paramIndex} AND last_seen >= $${paramIndex} ${siteFilter}
    `, params);
    
    // Sessions
    const sessionsResult = await query(`
      SELECT COUNT(*) as total
      FROM visitor_sessions
      WHERE started_at >= $${paramIndex} ${siteFilter}
    `, params);
    
    // Page views
    const pageViewsResult = await query(`
      SELECT COUNT(*) as total
      FROM page_views
      WHERE viewed_at >= $${paramIndex} ${siteFilter}
    `, params);
    
    // Conversations
    const conversationsResult = await query(`
      SELECT COUNT(*) as total
      FROM conversations
      WHERE created_at >= $${paramIndex} ${siteFilter ? siteFilter : ''}
    `, siteFilter ? params : [startDate]);
    
    // Average session duration
    const avgDurationResult = await query(`
      SELECT AVG(duration_seconds) as avg_duration
      FROM visitor_sessions
      WHERE started_at >= $${paramIndex} AND duration_seconds IS NOT NULL ${siteFilter}
    `, params);
    
    // Bounce rate (sessions with only 1 page view)
    const bounceResult = await query(`
      SELECT 
        COUNT(CASE WHEN page_views = 1 THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100 as bounce_rate
      FROM visitor_sessions
      WHERE started_at >= $${paramIndex} ${siteFilter}
    `, params);
    
    // Online visitors
    const onlineVisitors = siteId ? await getOnlineVisitors(siteId) : [];
    
    res.json({
      period,
      totalVisitors: parseInt(visitorsResult.rows[0].total) || 0,
      newVisitors: parseInt(newVisitorsResult.rows[0].count) || 0,
      returningVisitors: parseInt(returningVisitorsResult.rows[0].count) || 0,
      totalSessions: parseInt(sessionsResult.rows[0].total) || 0,
      totalPageViews: parseInt(pageViewsResult.rows[0].total) || 0,
      totalConversations: parseInt(conversationsResult.rows[0].total) || 0,
      avgSessionDuration: Math.round(parseFloat(avgDurationResult.rows[0].avg_duration) || 0),
      bounceRate: parseFloat(bounceResult.rows[0].bounce_rate) || 0,
      onlineVisitorsCount: onlineVisitors.length
    });
    
  } catch (error) {
    logger.error('GetDashboardAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}

// Get online visitors list
async function getOnlineVisitorsList(req, res) {
  try {
    const { siteId } = req.query;
    
    // If no siteId provided, return empty array instead of error
    if (!siteId) {
      return res.json({ visitors: [] });
    }
    
    const visitors = await getOnlineVisitors(siteId);
    res.json({ visitors });
    
  } catch (error) {
    logger.error('GetOnlineVisitorsList error:', error);
    res.status(500).json({ error: 'Failed to fetch online visitors' });
  }
}

// Get visitor details and journey
async function getVisitorDetails(req, res) {
  try {
    const { visitorId } = req.params;
    
    // Visitor info
    const visitorResult = await query(`
      SELECT v.*, 
             COUNT(DISTINCT vs.id) as total_sessions,
             COUNT(DISTINCT c.id) as total_conversations
      FROM visitors v
      LEFT JOIN visitor_sessions vs ON v.id = vs.visitor_id
      LEFT JOIN conversations c ON v.id = c.visitor_id
      WHERE v.id = $1
      GROUP BY v.id
    `, [visitorId]);
    
    if (visitorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    
    const visitor = visitorResult.rows[0];
    
    // Journey
    const journey = await getVisitorJourney(visitorId);
    
    // Recent events
    const eventsResult = await query(`
      SELECT * FROM visitor_events
      WHERE visitor_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [visitorId]);
    
    res.json({
      visitor,
      journey,
      events: eventsResult.rows
    });
    
  } catch (error) {
    logger.error('GetVisitorDetails error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor details' });
  }
}

// Get top pages
async function getTopPages(req, res) {
  try {
    const { siteId, period = '7d', limit = 10 } = req.query;
    
    let daysAgo = 7;
    if (period === '24h') daysAgo = 1;
    else if (period === '7d') daysAgo = 7;
    else if (period === '30d') daysAgo = 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    const result = await query(`
      SELECT 
        page_url,
        page_title,
        COUNT(*) as views,
        COUNT(DISTINCT visitor_id) as unique_visitors
      FROM page_views
      WHERE viewed_at >= $1 ${siteId ? 'AND site_id = $3' : ''}
      GROUP BY page_url, page_title
      ORDER BY views DESC
      LIMIT $2
    `, siteId ? [startDate, limit, siteId] : [startDate, limit]);
    
    res.json({ pages: result.rows });
    
  } catch (error) {
    logger.error('GetTopPages error:', error);
    res.status(500).json({ error: 'Failed to fetch top pages' });
  }
}

// Get traffic sources
async function getTrafficSources(req, res) {
  try {
    const { siteId, period = '7d' } = req.query;
    
    let daysAgo = 7;
    if (period === '24h') daysAgo = 1;
    else if (period === '7d') daysAgo = 7;
    else if (period === '30d') daysAgo = 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    const result = await query(`
      SELECT 
        CASE 
          WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
          WHEN referrer LIKE '%google.%' THEN 'Google'
          WHEN referrer LIKE '%facebook.%' THEN 'Facebook'
          WHEN referrer LIKE '%twitter.%' THEN 'Twitter'
          WHEN referrer LIKE '%linkedin.%' THEN 'LinkedIn'
          ELSE 'Other'
        END as source,
        COUNT(*) as sessions
      FROM visitor_sessions
      WHERE started_at >= $1 ${siteId ? 'AND site_id = $2' : ''}
      GROUP BY source
      ORDER BY sessions DESC
    `, siteId ? [startDate, siteId] : [startDate]);
    
    res.json({ sources: result.rows });
    
  } catch (error) {
    logger.error('GetTrafficSources error:', error);
    res.status(500).json({ error: 'Failed to fetch traffic sources' });
  }
}

// Get device stats
async function getDeviceStats(req, res) {
  try {
    const { siteId, period = '7d' } = req.query;
    
    let daysAgo = 7;
    if (period === '24h') daysAgo = 1;
    else if (period === '7d') daysAgo = 7;
    else if (period === '30d') daysAgo = 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    
    // Device types
    const deviceResult = await query(`
      SELECT device_type, COUNT(*) as count
      FROM visitors
      WHERE last_seen >= $1 ${siteId ? 'AND site_id = $2' : ''}
      GROUP BY device_type
      ORDER BY count DESC
    `, siteId ? [startDate, siteId] : [startDate]);
    
    // Browsers
    const browserResult = await query(`
      SELECT browser, COUNT(*) as count
      FROM visitors
      WHERE last_seen >= $1 ${siteId ? 'AND site_id = $2' : ''}
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 5
    `, siteId ? [startDate, siteId] : [startDate]);
    
    // OS
    const osResult = await query(`
      SELECT os, COUNT(*) as count
      FROM visitors
      WHERE last_seen >= $1 ${siteId ? 'AND site_id = $2' : ''}
      GROUP BY os
      ORDER BY count DESC
    `, siteId ? [startDate, siteId] : [startDate]);
    
    res.json({
      devices: deviceResult.rows,
      browsers: browserResult.rows,
      operatingSystems: osResult.rows
    });
    
  } catch (error) {
    logger.error('GetDeviceStats error:', error);
    res.status(500).json({ error: 'Failed to fetch device stats' });
  }
}

module.exports = {
  trackPageView,
  getDashboardAnalytics,
  getOnlineVisitorsList,
  getVisitorDetails,
  getTopPages,
  getTrafficSources,
  getDeviceStats
};
