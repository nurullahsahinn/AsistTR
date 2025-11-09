/**
 * Widget Settings Routes
 */

const express = require('express');
const router = express.Router();
const widgetSettingsController = require('../controllers/widgetSettings.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Public endpoint (no auth required)
router.get('/public-config', widgetSettingsController.getPublicWidgetConfig);
router.get('/business-hours', widgetSettingsController.isWithinBusinessHours);

// Authenticated endpoints
router.get('/', authenticate, widgetSettingsController.getWidgetSettings);
router.put('/:siteId', authenticate, widgetSettingsController.updateWidgetSettings);

module.exports = router;
