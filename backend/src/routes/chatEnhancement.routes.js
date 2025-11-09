/**
 * Chat Enhancement Routes
 * Tags, Notes, Rating, Transfer
 */

const express = require('express');
const router = express.Router();
const chatEnhancementController = require('../controllers/chatEnhancement.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ===== TAGS =====
router.get('/tags', chatEnhancementController.getTags);
router.post('/tags', chatEnhancementController.createTag);
router.post('/tags/assign', chatEnhancementController.addTagToConversation);
router.delete('/tags/:conversationId/:tagId', chatEnhancementController.removeTagFromConversation);
router.get('/conversations/:conversationId/tags', chatEnhancementController.getConversationTags);

// ===== NOTES =====
router.get('/conversations/:conversationId/notes', chatEnhancementController.getConversationNotes);
router.post('/conversations/:conversationId/notes', chatEnhancementController.createNote);
router.put('/notes/:noteId', chatEnhancementController.updateNote);

// ===== RATING =====
router.post('/conversations/:conversationId/rating', chatEnhancementController.submitRating);

// ===== TRANSFER =====
router.post('/conversations/:conversationId/transfer', chatEnhancementController.transferChat);
router.get('/conversations/:conversationId/transfers', chatEnhancementController.getTransferHistory);

module.exports = router;
