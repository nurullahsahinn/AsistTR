/**
 * RAG Routes
 */

const express = require('express');
const router = express.Router();
const {
  createKnowledge,
  listKnowledge,
  getKnowledgeDetail,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  bulkCreate,
  generateAnswer,
  getReplysuggestion,
  checkOllamaHealth
} = require('../controllers/rag.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Health check (public)
router.get('/health', checkOllamaHealth);

// Korumalı endpoint'ler
router.use(authMiddleware);

// Knowledge base CRUD
router.post('/knowledge', createKnowledge);
router.get('/knowledge', listKnowledge);
router.get('/knowledge/:id', getKnowledgeDetail);
router.put('/knowledge/:id', updateKnowledgeItem);
router.delete('/knowledge/:id', deleteKnowledgeItem);
router.post('/knowledge/bulk', bulkCreate);

// AI yanıt üretme
router.post('/generate', generateAnswer);
router.post('/suggest', getReplysuggestion);

module.exports = router;

