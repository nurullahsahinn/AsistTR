/**
 * Metrics Routes
 */

const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Get agent performance metrics
router.get('/agent/:agentId', authenticate, metricsController.getAgentMetrics);

// Get site performance metrics
router.get('/site/:siteId', authenticate, metricsController.getSiteMetrics);

// Submit CSAT score (public - from widget)
router.post('/csat/:conversationId', metricsController.submitCSAT);

// Recalculate metrics for a conversation (admin)
router.post('/recalculate/:conversationId', authenticate, metricsController.recalculateMetrics);

module.exports = router;

