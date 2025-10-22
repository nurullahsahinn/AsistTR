/**
 * RAG Controller
 * Bilgi tabanı ve AI yanıt yönetimi
 */

const { 
  addKnowledge, 
  getKnowledgeList, 
  getKnowledge,
  updateKnowledge,
  deleteKnowledge,
  bulkAddKnowledge
} = require('../rag/knowledge.service');
const { generateRagResponse, suggestReply } = require('../rag/rag.service');
const { healthCheck } = require('../rag/ollama.service');
const logger = require('../utils/logger');

// Bilgi tabanına ekleme
async function createKnowledge(req, res) {
  try {
    const { siteId, title, content, metadata } = req.body;
    
    const result = await addKnowledge(siteId, title, content, metadata);
    
    res.status(201).json({ 
      message: 'Bilgi eklendi',
      knowledge: result 
    });
    
  } catch (error) {
    logger.error('CreateKnowledge hatası:', error);
    res.status(500).json({ error: 'Bilgi eklenemedi' });
  }
}

// Bilgi listesi
async function listKnowledge(req, res) {
  try {
    const { siteId } = req.query;
    
    const list = await getKnowledgeList(siteId);
    
    res.json({ knowledge: list });
    
  } catch (error) {
    logger.error('ListKnowledge hatası:', error);
    res.status(500).json({ error: 'Bilgiler alınamadı' });
  }
}

// Bilgi detay
async function getKnowledgeDetail(req, res) {
  try {
    const { id } = req.params;
    
    const knowledge = await getKnowledge(id);
    
    if (!knowledge) {
      return res.status(404).json({ error: 'Bilgi bulunamadı' });
    }
    
    res.json({ knowledge });
    
  } catch (error) {
    logger.error('GetKnowledgeDetail hatası:', error);
    res.status(500).json({ error: 'Bilgi alınamadı' });
  }
}

// Bilgi güncelle
async function updateKnowledgeItem(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const result = await updateKnowledge(id, updates);
    
    res.json({ 
      message: 'Bilgi güncellendi',
      knowledge: result 
    });
    
  } catch (error) {
    logger.error('UpdateKnowledge hatası:', error);
    res.status(500).json({ error: 'Bilgi güncellenemedi' });
  }
}

// Bilgi sil
async function deleteKnowledgeItem(req, res) {
  try {
    const { id } = req.params;
    
    await deleteKnowledge(id);
    
    res.json({ message: 'Bilgi silindi' });
    
  } catch (error) {
    logger.error('DeleteKnowledge hatası:', error);
    res.status(500).json({ error: 'Bilgi silinemedi' });
  }
}

// Toplu ekleme
async function bulkCreate(req, res) {
  try {
    const { siteId, items } = req.body;
    
    const results = await bulkAddKnowledge(siteId, items);
    
    res.status(201).json({ 
      message: `${results.length} bilgi eklendi`,
      knowledge: results 
    });
    
  } catch (error) {
    logger.error('BulkCreate hatası:', error);
    res.status(500).json({ error: 'Toplu ekleme başarısız' });
  }
}

// AI yanıt üret
async function generateAnswer(req, res) {
  try {
    const { conversationId, message } = req.body;
    
    const result = await generateRagResponse(conversationId, message);
    
    res.json(result);
    
  } catch (error) {
    logger.error('GenerateAnswer hatası:', error);
    res.status(500).json({ error: 'Yanıt üretilemedi' });
  }
}

// Agent'e öneri
async function getReplysuggestion(req, res) {
  try {
    const { conversationId, visitorMessage } = req.body;
    
    const result = await suggestReply(conversationId, visitorMessage);
    
    res.json(result);
    
  } catch (error) {
    logger.error('GetReplySuggestion hatası:', error);
    res.status(500).json({ error: 'Öneri alınamadı' });
  }
}

// Ollama health check
async function checkOllamaHealth(req, res) {
  try {
    const isHealthy = await healthCheck();
    
    res.json({ 
      status: isHealthy ? 'ok' : 'error',
      message: isHealthy ? 'Ollama çalışıyor' : 'Ollama erişilemiyor',
      url: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3'
    });
    
  } catch (error) {
    logger.error('CheckOllamaHealth hatası:', error);
    res.status(500).json({ status: 'error', message: 'Health check başarısız' });
  }
}

module.exports = {
  createKnowledge,
  listKnowledge,
  getKnowledgeDetail,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  bulkCreate,
  generateAnswer,
  getReplysuggestion,
  checkOllamaHealth
};

