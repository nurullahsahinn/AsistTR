/**
 * RAG (Retrieval-Augmented Generation) Service
 * Bilgi tabanını kullanarak AI yanıtları üretir
 */

const { searchKnowledge } = require('./knowledge.service');
const { generateChatResponse } = require('./ollama.service');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * RAG ile yanıt üret
 * 1. Bilgi tabanında ilgili içerikleri ara
 * 2. Sohbet geçmişini al
 * 3. LLM ile yanıt üret
 */
async function generateRagResponse(conversationId, userMessage) {
  try {
    // Conversation bilgilerini al
    const convResult = await query(
      'SELECT site_id FROM conversations WHERE id = $1',
      [conversationId]
    );
    
    if (convResult.rows.length === 0) {
      throw new Error('Conversation bulunamadı');
    }
    
    const siteId = convResult.rows[0].site_id;
    
    // 1. Bilgi tabanında ara
    const relevantKnowledge = await searchKnowledge(siteId, userMessage, 3);
    
    // 2. Sohbet geçmişini al (son 5 mesaj)
    const historyResult = await query(
      `SELECT sender_type, body 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [conversationId]
    );
    
    const chatHistory = historyResult.rows.reverse();
    
    // 3. Context oluştur
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      knowledgeContext = 'İlgili Bilgiler:\n';
      relevantKnowledge.forEach((item, index) => {
        knowledgeContext += `${index + 1}. ${item.title}\n${item.content}\n\n`;
      });
    }
    
    // 4. AI yanıtı üret
    const aiResponse = await generateChatResponse(
      userMessage,
      chatHistory,
      knowledgeContext
    );
    
    logger.info(`RAG yanıt üretildi - Conversation: ${conversationId}`);
    
    return {
      response: aiResponse,
      sources: relevantKnowledge.map(k => ({
        id: k.id,
        title: k.title
      })),
      hasKnowledge: relevantKnowledge.length > 0
    };
    
  } catch (error) {
    logger.error('GenerateRagResponse hatası:', error);
    return {
      response: 'Üzgünüm, şu anda size yardımcı olamıyorum. Bir temsilcimiz en kısa sürede size destek olacak.',
      sources: [],
      hasKnowledge: false,
      error: error.message
    };
  }
}

/**
 * Agent için AI önerisi üret
 * Agent mesaj yazarken yardımcı olmak için
 */
async function suggestReply(conversationId, visitorMessage) {
  try {
    const result = await generateRagResponse(conversationId, visitorMessage);
    
    return {
      suggestion: result.response,
      confidence: result.hasKnowledge ? 'high' : 'low',
      sources: result.sources
    };
    
  } catch (error) {
    logger.error('SuggestReply hatası:', error);
    return {
      suggestion: null,
      confidence: 'none',
      sources: []
    };
  }
}

module.exports = {
  generateRagResponse,
  suggestReply
};


