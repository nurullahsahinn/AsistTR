/**
 * Widget Routes
 */

const express = require('express');
const router = express.Router();
const { 
  getWidgetSettings, 
  createSite, 
  getSites,
  updateSiteSettings 
} = require('../controllers/widget.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Public endpoint - API key ile widget ayarlarını al
router.get('/settings/:apiKey', getWidgetSettings);

// Korumalı endpoint'ler (auth gerekli)
router.post('/sites', authMiddleware, createSite);
router.get('/sites', authMiddleware, getSites);
router.put('/sites/:siteId/settings', authMiddleware, updateSiteSettings);

module.exports = router;


