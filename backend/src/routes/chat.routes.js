/**
 * Chat Routes
 */

const express = require('express');
const router = express.Router();
const { 
  getConversations, 
  getMessages, 
  closeConversation,
  assignAgent 
} = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { apiLimiter } = require('../middleware/rateLimit.middleware');

// Tüm route'lar auth gerektirir
router.use(authMiddleware);
router.use(apiLimiter);

// Konuşmaları listele
router.get('/', getConversations);

// Konuşma mesajlarını getir
router.get('/:conversationId/messages', getMessages);

// Konuşmayı kapat
router.post('/:conversationId/close', closeConversation);

// Agent ata
router.post('/:conversationId/assign', assignAgent);

module.exports = router;

