/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Push subscriptions
router.post('/push/subscribe', notificationController.subscribePush);
router.post('/push/unsubscribe', notificationController.unsubscribePush);

// History
router.get('/history', notificationController.getNotificationHistory);
router.get('/unread-count', notificationController.getUnreadCount);

module.exports = router;
