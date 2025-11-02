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
const { authMiddleware, adminOnly } = require('../middleware/auth.middleware');
const { apiLimiter } = require('../middleware/rateLimit.middleware');

// Tüm route'lar auth gerektirir
router.use(authMiddleware);
router.use(apiLimiter);

// Bilgi Bankası Yönetimi (Sadece Admin)
router.post('/knowledge', adminOnly, createKnowledge);
router.post('/knowledge/bulk', adminOnly, bulkCreate);
router.get('/knowledge', adminOnly, listKnowledge);
router.get('/knowledge/:id', adminOnly, getKnowledgeDetail);
router.put('/knowledge/:id', adminOnly, updateKnowledgeItem);
router.delete('/knowledge/:id', adminOnly, deleteKnowledgeItem);

// AI Yanıt
router.post('/generate', generateAnswer);
router.post('/suggest', getReplysuggestion);

// Health Check
router.get('/health', checkOllamaHealth);


module.exports = router;



