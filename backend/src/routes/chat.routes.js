/**
 * Chat Routes
 */

const express = require('express');
const router = express.Router();
const { 
  getConversations, 
  getMessages, 
  closeConversation,
  assignAgent,
  deleteConversation,
  rateConversation // Yeni: Rating fonksiyonu
} = require('../controllers/chat.controller');
const { authMiddleware, adminOnly } = require('../middleware/auth.middleware');
const { apiLimiter } = require('../middleware/rateLimit.middleware');

// Public endpoint - Rating (auth gerekmez, visitor gönderiyor)
router.post('/:conversationId/rate', rateConversation);

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

// Konuşmayı sil (Sadece Admin)
router.delete('/:conversationId', adminOnly, deleteConversation);

module.exports = router;



