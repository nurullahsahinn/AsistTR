/**
 * Agent Management Routes
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Get all agents
router.get('/', agentController.getAgents);

// Get single agent
router.get('/:agentId', agentController.getAgent);

// Create new agent (admin only)
router.post('/', requireRole(['admin']), agentController.createAgent);

// Update agent (admin only)
router.put('/:agentId', requireRole(['admin']), agentController.updateAgent);

// Delete agent (admin only)
router.delete('/:agentId', requireRole(['admin']), agentController.deleteAgent);

// Update agent status
router.put('/:agentId/status', agentController.updateAgentStatus);

// Get agent statistics
router.get('/:agentId/stats', agentController.getAgentStats);

module.exports = router;
