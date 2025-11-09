/**
 * Metrics Controller
 * API endpoints for performance metrics
 */

const metricsService = require('../services/metrics.service');
const logger = require('../utils/logger');

/**
 * Get agent performance metrics
 */
async function getAgentMetrics(req, res) {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
    const end = endDate || new Date();

    const metrics = await metricsService.getAgentPerformanceMetrics(agentId, start, end);

    res.json({
      agentId,
      period: { startDate: start, endDate: end },
      metrics
    });

  } catch (error) {
    logger.error('GetAgentMetrics error:', error);
    res.status(500).json({ error: 'Failed to fetch agent metrics' });
  }
}

/**
 * Get site performance metrics
 */
async function getSiteMetrics(req, res) {
  try {
    const { siteId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const metrics = await metricsService.getSitePerformanceMetrics(siteId, start, end);

    res.json({
      siteId,
      period: { startDate: start, endDate: end },
      metrics
    });

  } catch (error) {
    logger.error('GetSiteMetrics error:', error);
    res.status(500).json({ error: 'Failed to fetch site metrics' });
  }
}

/**
 * Submit CSAT score
 */
async function submitCSAT(req, res) {
  try {
    const { conversationId } = req.params;
    const { score } = req.body; // 1-5

    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }

    await metricsService.saveCSATScore(conversationId, score);

    res.json({
      message: 'Thank you for your feedback!',
      score
    });

  } catch (error) {
    logger.error('SubmitCSAT error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

/**
 * Recalculate metrics for a conversation (admin)
 */
async function recalculateMetrics(req, res) {
  try {
    const { conversationId } = req.params;

    const metrics = await metricsService.calculateConversationMetrics(conversationId);

    if (!metrics) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      message: 'Metrics recalculated',
      metrics
    });

  } catch (error) {
    logger.error('RecalculateMetrics error:', error);
    res.status(500).json({ error: 'Failed to recalculate metrics' });
  }
}

module.exports = {
  getAgentMetrics,
  getSiteMetrics,
  submitCSAT,
  recalculateMetrics
};

