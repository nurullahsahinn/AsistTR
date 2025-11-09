/**
 * Presence Routes
 */

const express = require('express');
const router = express.Router();
const presenceController = require('../controllers/presence.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Agents presence
router.get('/agents', presenceController.getAllAgentsPresence);
router.get('/agents/:agentId', presenceController.getAgentPresence);
router.put('/status', presenceController.updateAgentStatus);
router.get('/online-count', presenceController.getOnlineAgentsCount);

// Typing status
router.get('/typing/:conversationId', presenceController.getTypingStatus);

module.exports = router;
