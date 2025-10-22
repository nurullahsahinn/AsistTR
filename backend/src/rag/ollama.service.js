/**
 * Ollama Service
 * Yerel LLM (Large Language Model) servisi
 * Ollama kullanarak AI yanıtları üretir
 */

const logger = require('../utils/logger');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Ollama'ya soru gönder ve yanıt al
 */
async function generateResponse(prompt, context = '') {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(prompt, context),
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API hatası: ${response.status}`);
    }

    const data = await response.json();
    return data.response;

  } catch (error) {
    logger.error('Ollama generateResponse hatası:', error);
    
    // Ollama çalışmıyorsa varsayılan yanıt döndür
    return 'Üzgünüm, şu anda AI asistanı kullanılamıyor. Bir temsilcimiz en kısa sürede size yardımcı olacak.';
  }
}

/**
 * Embedding oluştur (vektör temsili)
 */
async function generateEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding hatası: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;

  } catch (error) {
    logger.error('Ollama generateEmbedding hatası:', error);
    return null;
  }
}

/**
 * Prompt oluştur
 */
function buildPrompt(userMessage, context) {
  return `Sen bir müşteri destek asistanısın. Türkçe, kibar ve yardımsever yanıtlar veriyorsun.

${context ? `İlgili Bilgiler:\n${context}\n` : ''}

Müşteri Mesajı: ${userMessage}

Lütfen kısa (maksimum 2-3 cümle) ve net bir yanıt ver:`;
}

/**
 * Sohbet geçmişi ile yanıt üret
 */
async function generateChatResponse(userMessage, chatHistory = [], knowledgeContext = '') {
  try {
    let prompt = `Sen bir müşteri destek asistanısın. Türkçe, kibar ve yardımsever yanıtlar veriyorsun.\n\n`;
    
    // Bilgi tabanı varsa ekle
    if (knowledgeContext) {
      prompt += `İlgili Bilgiler:\n${knowledgeContext}\n\n`;
    }
    
    // Sohbet geçmişini ekle
    if (chatHistory.length > 0) {
      prompt += `Önceki Sohbet:\n`;
      chatHistory.slice(-5).forEach(msg => {
        const role = msg.sender_type === 'visitor' ? 'Müşteri' : 'Asistan';
        prompt += `${role}: ${msg.body}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `Müşteri: ${userMessage}\n\nAsistan:`;
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API hatası: ${response.status}`);
    }

    const data = await response.json();
    return data.response.trim();

  } catch (error) {
    logger.error('Ollama generateChatResponse hatası:', error);
    return 'Üzgünüm, şu anda size yardımcı olamıyorum. Bir temsilcimiz en kısa sürede size destek olacak.';
  }
}

/**
 * Ollama'nın çalışıp çalışmadığını kontrol et
 */
async function healthCheck() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET'
    });
    
    return response.ok;
  } catch (error) {
    logger.warn('Ollama erişilemiyor:', error.message);
    return false;
  }
}

module.exports = {
  generateResponse,
  generateEmbedding,
  generateChatResponse,
  healthCheck
};

