/**
 * Queue Routes
 */

const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queue.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Get current queue status
router.get('/status', queueController.getQueueStatus);

// Get queue statistics
router.get('/stats', queueController.getQueueStats);

// Remove item from queue
router.delete('/:queueId', queueController.removeFromQueue);

module.exports = router;







