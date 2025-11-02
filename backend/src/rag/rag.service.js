/**
 * RAG (Retrieval-Augmented Generation) Service
 * Bilgi tabanını kullanarak AI yanıtları üretir
 */

const { searchKnowledge } = require('./knowledge.service');
const { generateChatResponse, generateChatResponseSync } = require('./ollama.service');
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
    logger.info(`Bilgi tabanı sonuç: ${relevantKnowledge.length} kayıt bulundu`);
    if (relevantKnowledge.length > 0) {
      logger.info(`En alakalı sonuç: ${relevantKnowledge[0].title}`);
    }
    
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
    
    // 3. Context oluştur - Soruya en uygun bölümü bul
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      const firstResult = relevantKnowledge[0];
      const content = firstResult.content;
      
      // Sorudaki anahtar kelimeleri bul
      const keywords = userMessage
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // İçerikte soruyla alakalı bölümü bul
      let bestChunk = '';
      let bestScore = 0;
      
      // İçeriği paragraf paragraf ayır
      const paragraphs = content.split(/\n\n+/);
      
      for (const paragraph of paragraphs) {
        // Her paragrafta kaç anahtar kelime var
        let score = 0;
        const lowerPara = paragraph.toLowerCase();
        keywords.forEach(keyword => {
          if (lowerPara.includes(keyword)) {
            score++;
          }
        });
        
        // En yüksek skorlu paragrafı seç
        if (score > bestScore) {
          bestScore = score;
          bestChunk = paragraph;
        }
      }
      
      // Eğer uygun paragraf bulunduysa onu kullan, yoksa baştan al
      if (bestChunk) {
        // Çok uzunsa kısalt (1500 karakter - daha uzun yanıtlar için)
        knowledgeContext = bestChunk.length > 1500 
          ? bestChunk.substring(0, 1500) + '...' 
          : bestChunk;
        logger.info(`En uygun bölüm bulundu (${bestChunk.length} karakter, skor: ${bestScore})`);
      } else {
        // Hiç uygun bölüm yoksa baştan 1500 karakter al
        knowledgeContext = content.substring(0, 1500) + '...';
        logger.info('Spesifik bölüm bulunamadı, baştan alındı');
      }
    }
    
    // 4. AI yanıtı üret
    const aiResponse = await generateChatResponseSync(
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
  suggestReply,
  generateRagResponseStream
};

/**
 * RAG ile streaming yanıt üret
 */
async function generateRagResponseStream(conversationId, userMessage) {
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
    logger.info(`Bilgi tabanı sonuç: ${relevantKnowledge.length} kayıt bulundu`);
    
    // 2. Sohbet geçmişini al
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
      const firstResult = relevantKnowledge[0];
      const content = firstResult.content;
      
      const keywords = userMessage
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      let bestChunk = '';
      let bestScore = 0;
      const paragraphs = content.split(/\n\n+/);
      
      for (const paragraph of paragraphs) {
        let score = 0;
        const lowerPara = paragraph.toLowerCase();
        keywords.forEach(keyword => {
          if (lowerPara.includes(keyword)) {
            score++;
          }
        });
        
        if (score > bestScore) {
          bestScore = score;
          bestChunk = paragraph;
        }
      }
      
      if (bestChunk) {
        knowledgeContext = bestChunk.length > 1500 
          ? bestChunk.substring(0, 1500) + '...' 
          : bestChunk;
      } else {
        knowledgeContext = content.substring(0, 1500) + '...';
      }
    }
    
    // 4. AI yanıtı stream olarak üret
    const stream = await generateChatResponse(
      userMessage,
      chatHistory,
      knowledgeContext
    );
    
    return {
      stream,
      sources: relevantKnowledge.map(k => ({
        id: k.id,
        title: k.title
      })),
      hasKnowledge: relevantKnowledge.length > 0
    };
    
  } catch (error) {
    logger.error('GenerateRagResponseStream hatası:', error);
    return null;
  }
}




