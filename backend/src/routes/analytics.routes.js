/**
 * Analytics Routes
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public endpoint for page tracking (no auth required)
router.post('/page-view', analyticsController.trackPageView);

// All routes below require authentication
router.use(authenticate);

// Dashboard analytics
router.get('/dashboard', analyticsController.getDashboardAnalytics);

// Online visitors
router.get('/online-visitors', analyticsController.getOnlineVisitorsList);

// Visitor details
router.get('/visitors/:visitorId', analyticsController.getVisitorDetails);

// Top pages
router.get('/top-pages', analyticsController.getTopPages);

// Traffic sources
router.get('/traffic-sources', analyticsController.getTrafficSources);

// Device stats
router.get('/device-stats', analyticsController.getDeviceStats);

// Agent performance
router.get('/agent-performance', analyticsController.getAgentPerformance);

module.exports = router;
