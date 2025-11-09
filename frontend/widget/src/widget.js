/**
 * AsistTR Chat Widget
 * Web sitelerine gömülebilir canlı destek widget'ı
 */

import { io } from 'socket.io-client'

(function() {
  'use strict';

  const API_URL = 'http://localhost:4000'
  const WS_URL = 'http://localhost:4000'
  
  // Global config'den API key al
  const API_KEY = window.AsistTRConfig?.apiKey || ''
  
  if (!API_KEY) {
    console.error('AsistTR: API key bulunamadı! window.AsistTRConfig.apiKey ayarlamanız gerekiyor.')
    return
  }
  
  console.log('AsistTR Widget başlatılıyor...', { API_KEY })

  // Session ID oluştur veya al
  let sessionId = localStorage.getItem('asistr_session_id')
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('asistr_session_id', sessionId)
  }

  // Track page view on load
  trackPageView();
  
  // Track page view on navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      trackPageView();
    }
  }).observe(document, { subtree: true, childList: true });

  let socket = null
  let conversationId = null
  let visitorId = null
  let isOpen = false
  let isUploading = false;
  let streamingMessage = ''; // Streaming mesaj
  
  // Voice call state
  let voiceCallId = null;
  let peerConnection = null;
  let localStream = null;
  let isInCall = false;
  let callStatus = 'idle'; // idle, calling, ringing, connected, ended
  
  // Proactive chat triggers
  let triggeredMessages = new Set(); // Zaten tetiklenen mesajları sakla
  let scrollTriggered = false;
  let exitIntentTriggered = false;
  let pageVisitTriggered = false;

  // Markdown parser
  function parseMarkdown(text) {
    const lines = text.split('\n');
    let html = '';
    let inCodeBlock = false;
    let inList = false;

    lines.forEach(line => {
      // Code block
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          html += '</code></pre>';
          inCodeBlock = false;
        } else {
          html += '<pre style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px; overflow-x: auto; margin: 8px 0;"><code style="font-family: monospace; font-size: 13px;">';
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        html += line + '\n';
        return;
      }

      // Heading 2
      if (line.startsWith('## ')) {
        html += `<h2 style="font-size: 16px; font-weight: bold; margin: 12px 0 8px 0;">${line.replace('## ', '')}</h2>`;
        return;
      }

      // Heading 3
      if (line.startsWith('### ')) {
        html += `<h3 style="font-size: 15px; font-weight: 600; margin: 10px 0 6px 0;">${line.replace('### ', '')}</h3>`;
        return;
      }

      // List item
      if (line.trim().startsWith('- ') || line.trim().match(/^\d+\. /)) {
        if (!inList) {
          html += '<ul style="margin: 8px 0; padding-left: 20px;">';
          inList = true;
        }
        const text = line.trim().replace(/^- /, '').replace(/^\d+\. /, '');
        html += `<li style="margin: 4px 0;">${formatInline(text)}</li>`;
        return;
      } else if (inList && line.trim() !== '') {
        html += '</ul>';
        inList = false;
      }

      // Empty line
      if (line.trim() === '') {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        return;
      }

      // Regular paragraph
      if (line.trim()) {
        html += `<p style="margin: 6px 0; line-height: 1.5;">${formatInline(line)}</p>`;
      }
    });

    if (inList) html += '</ul>';
    if (inCodeBlock) html += '</code></pre>';

    return html;
  }

  // Format inline markdown (bold, code)
  function formatInline(text) {
    // Bold **text**
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>');
    
    // Inline code `text`
    text = text.replace(/`(.+?)`/g, '<code style="background: rgba(0,0,0,0.08); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px;">$1</code>');
    
    return text;
  }

  const AttachmentPreview = ({ file }) => {
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      return `<img src="${file.url}" alt="${file.name}" class="asistr-attachment-image" />`;
    }
    return `
      <a href="${file.url}" target="_blank" rel="noopener noreferrer" class="asistr-attachment-link">
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13v4h-2v-4H8l4-4 4 4h-3z"/></svg>
        <span>${file.name}</span>
      </a>
    `;
  };

  // Widget HTML
  const widgetHTML = `
    <style>
      #asistr-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 99999;
      }

      #asistr-bubble {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer !important;
        box-shadow: 0 6px 20px rgba(2, 132, 199, 0.4), 0 2px 8px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
        border: 2px solid rgba(255,255,255,0.2);
      }

      #asistr-bubble:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 25px rgba(2, 132, 199, 0.5), 0 4px 12px rgba(0,0,0,0.2);
      }

      #asistr-bubble svg {
        width: 28px;
        height: 28px;
        fill: white;
        pointer-events: none;
      }

      #asistr-chat-window {
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 380px;
        height: 550px;
        background: white;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        display: none;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.3s ease-out;
        cursor: default !important;
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      #asistr-chat-window.open {
        display: flex;
      }

      #asistr-header {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: white;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: default !important;
      }

      #asistr-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      #asistr-header p {
        margin: 4px 0 0 0;
        font-size: 12px;
        opacity: 0.9;
      }

      #asistr-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer !important;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: all 0.2s ease;
      }

      #asistr-close:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
      }

      #asistr-welcome-form {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      #asistr-welcome-form input {
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      #asistr-welcome-form input:focus {
        border-color: #0284c7;
      }

      #asistr-welcome-form button {
        padding: 12px;
        background: #0284c7;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }

      #asistr-welcome-form button:hover {
        background: #0369a1;
      }

      #asistr-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        display: none;
        cursor: default !important;
      }

      #asistr-messages.active {
        display: block;
      }

      .asistr-message {
        margin-bottom: 16px;
        display: flex;
        gap: 8px;
      }

      .asistr-message.visitor {
        justify-content: flex-end;
      }

      .asistr-message-bubble {
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.4;
      }

      .asistr-message.agent .asistr-message-bubble {
        background: white;
        color: #1f2937;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05);
        border: 1px solid rgba(0,0,0,0.05);
      }

      .asistr-message.visitor .asistr-message-bubble {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
      }

      .asistr-message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
      }

      #asistr-input-area {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        background: white;
        display: none;
        cursor: default !important;
      }

      #asistr-input-area.active {
        display: block;
      }

      #asistr-input-form {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      #asistr-message-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 24px;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 120px;
        min-height: 44px;
        height: 44px;
        font-family: inherit;
        background: #f9fafb;
        transition: all 0.2s ease;
        box-sizing: border-box;
        display: block;
        width: 100%;
        overflow-y: auto;
        line-height: 1.5;
      }

      #asistr-message-input:focus {
        border-color: #0284c7;
        background: white;
        box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
      }

      #asistr-send-btn {
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
        flex-shrink: 0;
      }

      #asistr-send-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
      }

      #asistr-send-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .asistr-typing {
        display: inline-block;
        padding: 10px 14px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .asistr-typing span {
        display: inline-block;
        width: 8px;
        height: 8px;
        background: #9ca3af;
        border-radius: 50%;
        margin: 0 2px;
        animation: typing 1.4s infinite;
      }

      .asistr-typing span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .asistr-typing span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      ::-webkit-scrollbar {
        width: 6px;
      }

      ::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }

      #asistr-attach-btn {
        width: 44px;
        height: 44px;
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #asistr-attach-btn:hover { 
        color: #0284c7; 
        background: rgba(2, 132, 199, 0.1);
        transform: scale(1.05);
      }
      #asistr-attach-btn:disabled { cursor: not-allowed; opacity: 0.5; }

      #asistr-voice-btn {
        width: 44px;
        height: 44px;
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #asistr-voice-btn:hover { 
        color: #10b981; 
        background: rgba(16, 185, 129, 0.1);
        transform: scale(1.05);
      }
      #asistr-voice-btn.calling {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        animation: pulse 1.5s ease-in-out infinite;
      }
      #asistr-voice-btn.in-call {
        color: #10b981;
        background: rgba(16, 185, 129, 0.2);
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .asistr-call-status {
        background: #f0fdf4;
        border: 1px solid #86efac;
        color: #166534;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        text-align: center;
        margin: 8px 16px;
      }
      .asistr-call-status.ringing {
        background: #fef3c7;
        border-color: #fcd34d;
        color: #92400e;
      }
      .asistr-call-status.connected {
        background: #d1fae5;
        border-color: #6ee7b7;
        color: #065f46;
      }

      .hidden { display: none !important; }

      .asistr-attachment-image { max-width: 100%; max-height: 150px; border-radius: 8px; margin-top: 5px; }
      .asistr-attachment-link { display: flex; align-items: center; gap: 8px; background: #f3f4f6; padding: 8px; border-radius: 8px; color: #1f2937; text-decoration: none; margin-top: 5px; }
      
      /* Rating Modal */
      #asistr-rating-modal {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      #asistr-rating-modal.show { display: flex; }
      
      .asistr-rating-content {
        background: white;
        padding: 24px;
        border-radius: 16px;
        width: 90%;
        max-width: 320px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      
      .asistr-rating-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1f2937;
        text-align: center;
      }
      
      .asistr-stars {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
      }
      
      .asistr-star {
        font-size: 32px;
        cursor: pointer;
        color: #d1d5db;
        transition: all 0.2s;
      }
      
      .asistr-star:hover,
      .asistr-star.active {
        color: #fbbf24;
        transform: scale(1.1);
      }
      
      .asistr-feedback-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        margin-bottom: 16px;
      }
      
      .asistr-rating-buttons {
        display: flex;
        gap: 8px;
      }
      
      .asistr-rating-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .asistr-rating-btn.submit {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: white;
      }
      
      .asistr-rating-btn.submit:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
      }
      
      .asistr-rating-btn.skip {
        background: #f3f4f6;
        color: #6b7280;
      }
      
      .asistr-rating-btn.skip:hover {
        background: #e5e7eb;
      }

    </style>

    <div id="asistr-widget">
      <!-- Chat Bubble -->
      <div id="asistr-bubble">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>

      <!-- Chat Window -->
      <div id="asistr-chat-window">
        <div id="asistr-header">
          <div>
            <h3>AsistTR</h3>
            <p>Canlı Destek</p>
          </div>
          <button id="asistr-close">×</button>
        </div>

        <!-- Welcome Form -->
        <div id="asistr-welcome-form">
          <h4 style="margin: 0 0 8px 0; color: #1f2937;">Hoş geldiniz! 👋</h4>
          <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">Size nasıl yardımcı olabiliriz?</p>
          <input type="text" id="asistr-name" placeholder="Adınız" required />
          <input type="email" id="asistr-email" placeholder="E-posta (opsiyonel)" />
          <button id="asistr-start-chat">Sohbet Başlat</button>
        </div>

        <!-- Messages Area -->
        <div id="asistr-messages"></div>

        <!-- Input Area -->
        <div id="asistr-input-area">
          <div id="asistr-call-status" class="asistr-call-status" style="display: none;"></div>
          <form id="asistr-input-form">
            <button type="button" id="asistr-voice-btn" title="Sesli Arama">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </button>
            <button type="button" id="asistr-attach-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input type="file" id="asistr-file-input" class="hidden" />
            <textarea 
              id="asistr-message-input" 
              placeholder="Mesajınızı yazın..." 
              rows="1"
            ></textarea>
            <button type="submit" id="asistr-send-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </form>
        </div>
        
        <!-- Rating Modal -->
        <div id="asistr-rating-modal">
          <div class="asistr-rating-content">
            <div class="asistr-rating-title">Sohbeti değerlendirin</div>
            <div class="asistr-stars">
              <span class="asistr-star" data-rating="1">★</span>
              <span class="asistr-star" data-rating="2">★</span>
              <span class="asistr-star" data-rating="3">★</span>
              <span class="asistr-star" data-rating="4">★</span>
              <span class="asistr-star" data-rating="5">★</span>
            </div>
            <textarea 
              id="asistr-feedback" 
              class="asistr-feedback-input" 
              placeholder="Geri bildiriminiz (opsiyonel)"
            ></textarea>
            <div class="asistr-rating-buttons">
              <button class="asistr-rating-btn skip" id="asistr-rating-skip">Atla</button>
              <button class="asistr-rating-btn submit" id="asistr-rating-submit">Gönder</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  // Widget'ı DOM'a ekle
  function initWidget() {
    const widgetContainer = document.createElement('div')
    widgetContainer.innerHTML = widgetHTML
    document.body.appendChild(widgetContainer)

    // Event listener'lar
    document.getElementById('asistr-bubble').addEventListener('click', toggleChat)
    document.getElementById('asistr-close').addEventListener('click', toggleChat)
    document.getElementById('asistr-start-chat').addEventListener('click', startChat)
    document.getElementById('asistr-input-form').addEventListener('submit', sendMessage)
    document.getElementById('asistr-attach-btn').addEventListener('click', () => {
      document.getElementById('asistr-file-input').click();
    });
    document.getElementById('asistr-file-input').addEventListener('change', handleFileUpload);
    document.getElementById('asistr-voice-btn').addEventListener('click', toggleVoiceCall);
    
    // Rating event listeners
    const stars = document.querySelectorAll('.asistr-star');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.getAttribute('data-rating'));
        selectRating(rating);
      });
    });
    
    document.getElementById('asistr-rating-submit').addEventListener('click', submitRating);
    document.getElementById('asistr-rating-skip').addEventListener('click', closeRatingModal);
    
    // Enter tuşu ile gönder ve auto-resize
    const messageInput = document.getElementById('asistr-message-input');
    
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(e)
      }
    })
    
    // Auto-resize textarea
    let typingTimeout;
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      
      // Send typing indicator to agent
      if (socket && conversationId) {
        socket.emit('visitor:typing:start', { conversationId });
        
        // Clear previous timeout
        clearTimeout(typingTimeout);
        
        // Stop typing after 2 seconds of inactivity
        typingTimeout = setTimeout(() => {
          if (socket && conversationId) {
            socket.emit('visitor:typing:stop', { conversationId });
          }
        }, 2000);
      }
    })
  }

  function toggleChat() {
    const chatWindow = document.getElementById('asistr-chat-window')
    isOpen = !isOpen
    
    if (isOpen) {
      chatWindow.classList.add('open')
      
      // ✅ Eğer kayıtlı conversation varsa direkt chat göster, form gösterme
      const savedConversationId = localStorage.getItem('asistr_conversation_id')
      const savedVisitorName = localStorage.getItem('asistr_visitor_name')
      
      if (savedConversationId && savedVisitorName) {
        console.log('✅ Restoring previous session:', savedConversationId)
        
        // Form'u gizle, chat'i göster
        document.getElementById('asistr-welcome-form').style.display = 'none'
        document.getElementById('asistr-messages').classList.add('active')
        document.getElementById('asistr-input-area').classList.add('active')
        
        // Socket bağlantısı kur (eski conversation'a bağlanacak)
        connectSocket({ name: savedVisitorName, email: localStorage.getItem('asistr_visitor_email') || '' })
      }
    } else {
      chatWindow.classList.remove('open')
    }
  }

  function startChat() {
    const name = document.getElementById('asistr-name').value.trim()
    const email = document.getElementById('asistr-email').value.trim()

    if (!name) {
      alert('Lütfen adınızı girin')
      return
    }

    // Socket bağlantısı kur
    connectSocket({ name, email })

    // UI'yi değiştir
    document.getElementById('asistr-welcome-form').style.display = 'none'
    document.getElementById('asistr-messages').classList.add('active')
    document.getElementById('asistr-input-area').classList.add('active')

    addMessage('agent', `Merhaba ${name}! Size nasıl yardımcı olabilirim?`)
  }

  function connectSocket(visitorInfo) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('Socket bağlandı:', socket.id)
      
      // Önceki conversation'ı kontrol et
      const savedConversationId = localStorage.getItem('asistr_conversation_id')
      const savedVisitorId = localStorage.getItem('asistr_visitor_id')
      
      console.log('💾 Saved conversation:', savedConversationId)
      
      socket.emit('visitor:connect', {
        apiKey: API_KEY,
        sessionId,
        visitorInfo,
        resumeConversationId: savedConversationId, // Backend bunu kontrol edecek
        resumeVisitorId: savedVisitorId
      })
    })

    socket.on('visitor:connected', (data) => {
      conversationId = data.conversationId
      visitorId = data.visitorId
      
      // LocalStorage'a kaydet (visitor name & email de kaydet)
      localStorage.setItem('asistr_conversation_id', conversationId)
      localStorage.setItem('asistr_visitor_id', visitorId)
      if (visitorInfo?.name) {
        localStorage.setItem('asistr_visitor_name', visitorInfo.name)
      }
      if (visitorInfo?.email) {
        localStorage.setItem('asistr_visitor_email', visitorInfo.email)
      }
      
      console.log('✅ Conversation:', data.isResumed ? 'RESUMED' : 'NEW', conversationId)
      
      // Eğer conversation resume edildiyse, eski mesajları yükle
      if (data.isResumed && data.messages) {
        data.messages.forEach(msg => {
          addMessage(msg.sender_type === 'visitor' ? 'user' : 'agent', msg.body)
        })
      }
    })

    socket.on('message:received', (message) => {
      if (message.senderType === 'agent' || message.senderType === 'bot') {
        // Streaming mesajı temizle
        streamingMessage = '';
        const streamingDiv = document.getElementById('asistr-streaming-message');
        if (streamingDiv) streamingDiv.remove();
        
        addMessage('agent', message.body)
      }
    })

    // Streaming mesaj parçası
    socket.on('message:chunk', (data) => {
      if (data.conversationId === conversationId) {
        streamingMessage += data.chunk;
        updateStreamingMessage(streamingMessage);
      }
    })

    socket.on('typing:agent', () => {
      showTyping()
    })

    socket.on('typing:stop', () => {
      hideTyping()
    })
    
    // Voice call events
    socket.on('voice:call:accepted', async (data) => {
      console.log('Agent çağrıyı kabul etti:', data);
      callStatus = 'connecting';
      updateCallUI();
      
      // Setup WebRTC connection
      await setupPeerConnection();
    });
    
    socket.on('voice:webrtc:answer', async (data) => {
      console.log('WebRTC answer alındı');
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        callStatus = 'connected';
        updateCallUI();
      }
    });
    
    socket.on('voice:webrtc:ice-candidate', async (data) => {
      console.log('ICE candidate alındı');
      if (peerConnection && data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
    
    socket.on('voice:call:ended', (data) => {
      console.log('Çağrı sonlandırıldı:', data);
      endVoiceCall();
    });

    socket.on('disconnect', () => {
      console.log('Socket bağlantısı kesildi')
      if (isInCall) {
        endVoiceCall();
      }
    })
  }

  function sendMessage(e, attachments = null) {
    if (e) e.preventDefault()
    
    const input = document.getElementById('asistr-message-input')
    const message = input.value.trim()

    if ((!message && !attachments) || !socket || !conversationId) return

    // Mesajı gönder
    socket.emit('message:send', {
      conversationId,
      body: message,
      senderType: 'visitor',
      attachments: attachments
    })

    // UI'ye ekle
    addMessage('visitor', message, attachments)
    input.value = ''
    input.style.height = '44px' // Reset to initial height
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    document.getElementById('asistr-attach-btn').disabled = true;

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        // Auth token'i eklememiz gerekebilir, ama şimdilik public yapalım
      });

      if (!response.ok) {
        throw new Error('Dosya yüklenemedi.');
      }
      
      const result = await response.json();
      sendMessage(null, [result.file]);

    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya yüklenirken bir hata oluştu.');
    } finally {
      document.getElementById('asistr-attach-btn').disabled = false;
      event.target.value = ""; // Input'u sıfırla
    }
  }

  function addMessage(type, text, attachments = null) {
    const messagesContainer = document.getElementById('asistr-messages')
    const messageDiv = document.createElement('div')
    messageDiv.className = `asistr-message ${type}`
    
    const now = new Date()
    const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    
    const attachmentsHTML = attachments 
      ? attachments.map(file => AttachmentPreview({ file })).join('') 
      : '';

    // Markdown parse et (sadece agent/bot mesajları için)
    const messageContent = (type === 'agent' || type === 'bot') ? parseMarkdown(text) : text;

    messageDiv.innerHTML = `
      <div class="asistr-message-bubble">
        ${text ? `<div>${messageContent}</div>` : ''}
        ${attachmentsHTML ? `<div class="mt-2">${attachmentsHTML}</div>` : ''}
        <div class="asistr-message-time">${time}</div>
      </div>
    `
    
    messagesContainer.appendChild(messageDiv)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  // Streaming mesajı güncelle
  function updateStreamingMessage(text) {
    const messagesContainer = document.getElementById('asistr-messages');
    let streamingDiv = document.getElementById('asistr-streaming-message');
    
    if (!streamingDiv) {
      streamingDiv = document.createElement('div');
      streamingDiv.id = 'asistr-streaming-message';
      streamingDiv.className = 'asistr-message agent';
      messagesContainer.appendChild(streamingDiv);
    }

    const now = new Date();
    const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const messageContent = parseMarkdown(text);

    streamingDiv.innerHTML = `
      <div class="asistr-message-bubble">
        <div>${messageContent}</div>
        <span style="display: inline-block; width: 2px; height: 16px; background: currentColor; animation: blink 1s infinite; margin-left: 2px;"></span>
        <div class="asistr-message-time">${time}</div>
      </div>
    `;

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTyping() {
    const messagesContainer = document.getElementById('asistr-messages')
    const typingDiv = document.createElement('div')
    typingDiv.id = 'asistr-typing-indicator'
    typingDiv.className = 'asistr-message agent'
    typingDiv.innerHTML = `
      <div class="asistr-typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `
    messagesContainer.appendChild(typingDiv)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  function hideTyping() {
    const typingIndicator = document.getElementById('asistr-typing-indicator')
    if (typingIndicator) {
      typingIndicator.remove()
    }
  }

  // ===== Voice Call Functions =====
  
  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  async function toggleVoiceCall() {
    if (isInCall) {
      // End call
      await endVoiceCall();
    } else {
      // Start call
      await startVoiceCall();
    }
  }
  
  async function startVoiceCall() {
    try {
      if (!conversationId || !visitorId) {
        alert('Lütfen önce sohbet başlatın');
        return;
      }
      
      // Update UI
      callStatus = 'calling';
      updateCallUI();
      
      // Request microphone permission
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create voice call in backend
      const response = await fetch(`${API_URL}/api/voice/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, visitorId })
      });
      
      const data = await response.json();
      voiceCallId = data.voiceCallId;
      
      isInCall = true;
      callStatus = 'ringing';
      updateCallUI();
      
      console.log('Sesli çağrı başlatıldı:', voiceCallId);
      
    } catch (error) {
      console.error('Sesli çağrı başlatma hatası:', error);
      alert('Çağrı başlatılamadı. Mikrofon erişimine izin verdiğinizden emin olun.');
      await endVoiceCall();
    }
  }
  
  async function setupPeerConnection() {
    try {
      peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('✅ Remote audio track received');
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play();
        
        // ✅ Audio track geldi, bağlantı başarılı!
        callStatus = 'connected';
        updateCallUI();
      };
      
      // ✅ Connection state değişikliklerini izle
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          callStatus = 'connected';
          updateCallUI();
        } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          endVoiceCall();
        }
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('voice:webrtc:ice-candidate', {
            voiceCallId,
            conversationId,
            candidate: event.candidate
          });
        }
      };
      
      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('voice:webrtc:offer', {
        voiceCallId,
        conversationId,
        offer: peerConnection.localDescription
      });
      
      console.log('WebRTC offer gönderildi');
      
    } catch (error) {
      console.error('Peer connection kurulum hatası:', error);
      await endVoiceCall();
    }
  }
  
  async function endVoiceCall() {
    try {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      
      // Close peer connection
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      
      // Notify backend
      if (voiceCallId) {
        await fetch(`${API_URL}/api/voice/${voiceCallId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'user_hangup' })
        });
      }
      
      isInCall = false;
      callStatus = 'idle';
      voiceCallId = null;
      updateCallUI();
      
      console.log('Sesli çağrı sonlandırıldı');
      
    } catch (error) {
      console.error('Çağrı sonlandırma hatası:', error);
    }
  }
  
  function updateCallUI() {
    const voiceBtn = document.getElementById('asistr-voice-btn');
    const callStatusDiv = document.getElementById('asistr-call-status');
    
    if (!voiceBtn || !callStatusDiv) return;
    
    // Update button state and title
    voiceBtn.className = '';
    if (callStatus === 'calling' || callStatus === 'ringing') {
      voiceBtn.classList.add('calling');
      voiceBtn.title = 'Aramayı Sonlandır';
    } else if (callStatus === 'connected' || callStatus === 'connecting') {
      voiceBtn.classList.add('in-call');
      voiceBtn.title = 'Aramayı Sonlandır';
    } else {
      voiceBtn.title = 'Sesli Arama';
    }
    
    // Update status message
    if (callStatus === 'idle') {
      callStatusDiv.style.display = 'none';
      callStatusDiv.innerHTML = '';
    } else {
      callStatusDiv.style.display = 'block';
      callStatusDiv.className = 'asistr-call-status ' + callStatus;
      
      switch (callStatus) {
        case 'calling':
          callStatusDiv.innerHTML = 'Çağrı başlatılıyor... <button onclick="window.asistTR_endCall()" style="margin-left:8px;padding:2px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">İptal</button>';
          break;
        case 'ringing':
          callStatusDiv.innerHTML = 'Temsilci aranıyor... <button onclick="window.asistTR_endCall()" style="margin-left:8px;padding:2px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">İptal</button>';
          break;
        case 'connecting':
          callStatusDiv.innerHTML = '✅ Temsilci kabul etti, bağlanıyor... <button onclick="window.asistTR_endCall()" style="margin-left:8px;padding:2px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Kapat</button>';
          break;
        case 'connected':
          callStatusDiv.innerHTML = '🎤 Çağrı bağlandı - Konuşabilirsiniz <button onclick="window.asistTR_endCall()" style="margin-left:8px;padding:2px 8px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Kapat</button>';
          break;
      }
    }
  }

  // ✅ Global fonksiyon: Inline button'dan çağrılabilsin
  window.asistTR_endCall = async function() {
    await endVoiceCall();
  };

  // Widget'ı başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget)
  } else {
    initWidget()
  }
  
  // ===== Proactive Chat Triggers =====
  
  // Page visit trigger - sayfa yüklendikten X saniye sonra
  function setupPageVisitTrigger() {
    setTimeout(() => {
      if (!isOpen && !pageVisitTriggered) {
        pageVisitTriggered = true;
        showProactiveMessage('Hoş geldiniz! 👋 Size nasıl yardımcı olabiliriz?');
      }
    }, 10000); // 10 saniye sonra
  }
  
  // Scroll trigger - sayfa %50'den fazla scroll edildiğinde
  function setupScrollTrigger() {
    window.addEventListener('scroll', () => {
      if (scrollTriggered || isOpen) return;
      
      const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      
      if (scrollPercentage >= 50) {
        scrollTriggered = true;
        showProactiveMessage('💬 İlginizi çeken bir şey mi buldunuz? Sorularınızı yanıtlamaktan mutluluk duyarız.');
      }
    });
  }
  
  // Exit intent trigger - kullanıcı sayfadan çıkmaya çalıştığında
  function setupExitIntentTrigger() {
    document.addEventListener('mouseleave', (e) => {
      if (exitIntentTriggered || isOpen) return;
      
      // Fare ekranın üstünden çıktıysa (address bar'a gidiyorsa)
      if (e.clientY <= 0) {
        exitIntentTriggered = true;
        showProactiveMessage('⚠️ Gitmeden önce yardım edebileceğimiz bir şey var mı?');
      }
    });
  }
  
  // Cart abandonment trigger - sepet sayfasında belirli süre geçince
  let cartAbandoned = false;
  function setupCartAbandonmentTrigger() {
    // Check if we're on cart/checkout page
    const currentUrl = window.location.href.toLowerCase();
    const isCartPage = currentUrl.includes('cart') || 
                       currentUrl.includes('sepet') || 
                       currentUrl.includes('checkout') || 
                       currentUrl.includes('odeme');
    
    if (!isCartPage) return;
    
    // Wait 2 minutes on cart page
    setTimeout(() => {
      if (!cartAbandoned && !isOpen) {
        cartAbandoned = true;
        showProactiveMessage('🛒 Sepetinizi tamamlamak için yardıma mı ihtiyacınız var? Size yardımcı olalım!');
      }
    }, 120000); // 2 minutes
  }
  
  // High-value page trigger - pricing/ücretlendirme sayfalarında
  let highValuePageTriggered = false;
  function setupHighValuePageTrigger() {
    const currentUrl = window.location.href.toLowerCase();
    const isHighValuePage = currentUrl.includes('pricing') || 
                           currentUrl.includes('ucretlendirme') || 
                           currentUrl.includes('fiyat') ||
                           currentUrl.includes('plans') ||
                           currentUrl.includes('paket');
    
    if (!isHighValuePage) return;
    
    // Wait 30 seconds on high-value pages
    setTimeout(() => {
      if (!highValuePageTriggered && !isOpen) {
        highValuePageTriggered = true;
        showProactiveMessage('💰 Fiyatlandırma hakkında sorularınız mı var? Size yardımcı olabiliriz!');
      }
    }, 30000); // 30 seconds
  }
  
  // Returning visitor trigger - daha önce gelmiş ziyaretçilere özel mesaj
  let returningVisitorTriggered = false;
  function setupReturningVisitorTrigger() {
    const visitCount = parseInt(localStorage.getItem('asistr_visit_count') || '0');
    localStorage.setItem('asistr_visit_count', (visitCount + 1).toString());
    
    // 3. ziyaretten sonra mesaj göster
    if (visitCount >= 2 && !returningVisitorTriggered) {
      setTimeout(() => {
        if (!isOpen) {
          returningVisitorTriggered = true;
          showProactiveMessage('👋 Tekrar hoş geldiniz! Size nasıl yardımcı olabiliriz?');
        }
      }, 5000); // 5 seconds
    }
  }
  
  // Idle trigger - 3 dakika boyunca hareket yoksa
  let idleTimeout;
  let idleTriggered = false;
  function setupIdleTrigger() {
    function resetIdleTimer() {
      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        if (!idleTriggered && !isOpen) {
          idleTriggered = true;
          showProactiveMessage('💤 Hala orada mısınız? Size yardımcı olabilir miyiz?');
        }
      }, 180000); // 3 minutes
    }
    
    // Reset timer on user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetIdleTimer, true);
    });
    
    resetIdleTimer();
  }
  
  // Element visibility trigger - belirli elementler görünür olduğunda
  function setupElementVisibilityTrigger() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isOpen) {
          const triggerMessage = entry.target.dataset.asistrTrigger;
          if (triggerMessage && !triggeredMessages.has(triggerMessage)) {
            triggeredMessages.add(triggerMessage);
            showProactiveMessage(triggerMessage);
          }
        }
      });
    }, { threshold: 0.5 });
    
    // Observe elements with data-asistr-trigger attribute
    document.querySelectorAll('[data-asistr-trigger]').forEach(el => {
      observer.observe(el);
    });
  }
  
  // Proactive message göster
  function showProactiveMessage(message) {
    // Widget bubble'da küçük bir bildirim badge'i göster
    const bubble = document.getElementById('asistr-bubble');
    if (bubble) {
      const badge = document.createElement('div');
      badge.id = 'asistr-notification-badge';
      badge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        animation: bounce 1s infinite;
      `;
      badge.textContent = '1';
      bubble.appendChild(badge);
      
      // Badge tıklandığında widget aç ve mesajı göster
      bubble.addEventListener('click', () => {
        if (badge) badge.remove();
      });
    }
  }
  
  // Tüm trigger'ları aktif et
  setupPageVisitTrigger();
  setupScrollTrigger();
  setupExitIntentTrigger();
  setupCartAbandonmentTrigger();
  setupHighValuePageTrigger();
  setupReturningVisitorTrigger();
  setupIdleTrigger();
  setupElementVisibilityTrigger();
  
  // ===== Page Tracking Function =====
  function trackPageView() {
    // Visitor bilgilerini topla
    const pageData = {
      apiKey: API_KEY,
      sessionId: sessionId,
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      language: navigator.language,
      timestamp: new Date().toISOString()
    };
    
    // Backend'e gönder
    fetch(`${API_URL}/api/analytics/page-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageData)
    }).catch(err => console.error('Page tracking error:', err));
  }
  
  // ===== Rating Functions =====
  let selectedRating = 0;
  
  function showRatingModal() {
    document.getElementById('asistr-rating-modal').classList.add('show');
  }
  
  function closeRatingModal() {
    document.getElementById('asistr-rating-modal').classList.remove('show');
    selectedRating = 0;
    document.querySelectorAll('.asistr-star').forEach(star => {
      star.classList.remove('active');
    });
    document.getElementById('asistr-feedback').value = '';
  }
  
  function selectRating(rating) {
    selectedRating = rating;
    const stars = document.querySelectorAll('.asistr-star');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }
  
  async function submitRating() {
    if (selectedRating === 0) {
      alert('Lütfen bir yıldız seçin');
      return;
    }
    
    const feedback = document.getElementById('asistr-feedback').value.trim();
    
    try {
      const response = await fetch(`${API_URL}/api/chat/${conversationId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, feedback })
      });
      
      if (response.ok) {
        closeRatingModal();
        addMessage('agent', 'Teşekkürler! Geri bildiriminiz kaydedildi. 🙏');
      } else {
        alert('Değerlendirme gönderilemedi.');
      }
    } catch (error) {
      console.error('Rating error:', error);
      alert('Değerlendirme gönderilemedi.');
    }
  }
  
  // Expose showRatingModal for manual trigger
  window.showChatRating = showRatingModal;

})();

