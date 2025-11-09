/**
 * Canned Responses Routes
 */

const express = require('express');
const router = express.Router();
const cannedController = require('../controllers/canned.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Get all canned responses
router.get('/', cannedController.getCannedResponses);

// Create canned response
router.post('/', cannedController.createCannedResponse);

// Update canned response
router.put('/:id', cannedController.updateCannedResponse);

// Delete canned response
router.delete('/:id', cannedController.deleteCannedResponse);

module.exports = router;
