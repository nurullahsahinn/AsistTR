/**
 * Offline Message Routes
 */

const express = require('express');
const router = express.Router();
const offlineMessageController = require('../controllers/offlineMessage.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Submit offline message (public)
router.post('/submit', offlineMessageController.submitOfflineMessage);

// Get offline messages (admin)
router.get('/', authenticate, offlineMessageController.getOfflineMessages);

// Update message status
router.put('/:messageId/status', authenticate, offlineMessageController.updateMessageStatus);

// Delete message
router.delete('/:messageId', authenticate, offlineMessageController.deleteOfflineMessage);

module.exports = router;

