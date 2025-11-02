/**
 * Ollama Service
 * Yerel LLM (Large Language Model) servisi
 * Ollama kullanarak AI yanıtları üretir
 */

const logger = require('../utils/logger');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text:latest';

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
        model: OLLAMA_EMBED_MODEL,
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
    let prompt = '';
    
    // DEBUG: Context'i logla
    if (knowledgeContext) {
      logger.info(`Knowledge context uzunluğu: ${knowledgeContext.length} karakter`);
      logger.info(`Context içeriği: ${knowledgeContext.substring(0, 200)}...`);
    }
    
    // Bilgi tabanı varsa SADECE onu kullan
    if (knowledgeContext) {
      prompt = `Aşağıdaki metinde yanıt var. Metni AYNEN kullan ve MARKDOWN formatında yaz.

METİN:
${knowledgeContext}

Soru: ${userMessage}

Yukarıdaki metindeki cevabı TAMAMEN kullanarak MARKDOWN formatında yanıt ver:
- Başlıklar için ## kullan
- Liste için - veya 1. kullan  
- Vurgular için **kalın** veya *italik* kullan
- Kod için \`kod\` kullan

Yanıt:
`;
    } else {
      // Bilgi tabanı yoksa genel yanıt
      prompt = `Sen bir müşteri destek asistanısın. Türkçe, kibar ve yardımsever yanıtlar veriyorsun.\n\n`;
      
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
    }
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: true, // Streaming aktif
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: 1000,
          repeat_penalty: 1.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API hatası: ${response.status}`);
    }

    // Streaming response'u return et
    return response.body;

  } catch (error) {
    logger.error('Ollama generateChatResponse hatası:', error);
    return null;
  }
}

/**
 * Non-streaming versiyonu (eski kullanımlar için)
 */
async function generateChatResponseSync(userMessage, chatHistory = [], knowledgeContext = '') {
  try {
    let prompt = '';
    
    if (knowledgeContext) {
      prompt = `Aşağıdaki metinde yanıt var. Metni AYNEN kullan ve MARKDOWN formatında yaz.

METİN:
${knowledgeContext}

Soru: ${userMessage}

Yukarıdaki metindeki cevabı TAMAMEN kullanarak MARKDOWN formatında yanıt ver:
- Başlıklar için ## kullan
- Liste için - veya 1. kullan  
- Vurgular için **kalın** veya *italik* kullan
- Kod için \`kod\` kullan

Yanıt:
`;
    } else {
      prompt = `Sen bir müşteri destek asistanısın. Türkçe, kibar ve yardımsever yanıtlar veriyorsun.\n\n`;
      
      if (chatHistory.length > 0) {
        prompt += `Önceki Sohbet:\n`;
        chatHistory.slice(-5).forEach(msg => {
          const role = msg.sender_type === 'visitor' ? 'Müşteri' : 'Asistan';
          prompt += `${role}: ${msg.body}\n`;
        });
        prompt += '\n';
      }
      
      prompt += `Müşteri: ${userMessage}\n\nAsistan:`;
    }
    
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
          temperature: 0.1,
          top_p: 0.9,
          num_predict: 1000,
          repeat_penalty: 1.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API hatası: ${response.status}`);
    }

    const data = await response.json();
    const generatedResponse = data.response?.trim();
    
    if (!generatedResponse) {
      throw new Error('Ollama boş yanıt döndürdü');
    }
    
    return generatedResponse;

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
  generateChatResponseSync,
  healthCheck
};




