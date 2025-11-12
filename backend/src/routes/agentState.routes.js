/**
 * Agent State Routes
 * Routes for managing agent availability states
 */

const express = require('express');
const router = express.Router();
const agentStateController = require('../controllers/agentState.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Get current agent state
router.get('/state', agentStateController.getAgentState);

// Update agent state
router.put('/state', agentStateController.updateAgentState);

// Get all agents states (admin/monitoring)
router.get('/states/all', agentStateController.getAllAgentsStates);

// Break management
router.post('/break/start', agentStateController.startBreak);
router.post('/break/end', agentStateController.endBreak);

module.exports = router;







