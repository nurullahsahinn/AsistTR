import { useState, useEffect, useRef } from 'react'
import { chatApi, ragApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import socketService from '../services/socket'
import toast from 'react-hot-toast'
import { FiSend, FiZap, FiXCircle, FiTrash2, FiPaperclip, FiDownload } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { userApi } from '../services/api'

const AttachmentPreview = ({ file }) => {
  const isImage = file.type.startsWith('image/');
  
  if (isImage) {
    return <img src={file.url} alt={file.name} className="max-w-xs max-h-48 rounded-lg" />;
  }

  return (
    <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-gray-200 p-2 rounded-lg">
      <FiDownload />
      <span>{file.name}</span>
    </a>
  );
};

// Basit markdown parser
const MarkdownText = ({ text, isBot }) => {
  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-outside ml-5 my-2 space-y-1">
          {listItems.map((item, i) => <li key={i} className="ml-1">{item}</li>)}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, index) => {
    // Code block
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushList();
        elements.push(
          <pre key={`code-${index}`} className={`my-2 p-3 rounded overflow-x-auto ${
            isBot ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800'
          }`}>
            <code className="text-sm font-mono">{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${index}`} className="text-lg font-bold mb-2 mt-3">
          {line.replace('## ', '')}
        </h2>
      );
      return;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${index}`} className="text-base font-semibold mb-2 mt-2">
          {line.replace('### ', '')}
        </h3>
      );
      return;
    }

    // List item
    if (line.trim().startsWith('- ') || line.trim().match(/^\d+\. /)) {
      inList = true;
      const text = line.trim().replace(/^- /, '').replace(/^\d+\. /, '');
      listItems.push(formatInlineMarkdown(text, isBot));
      return;
    }

    // Flush list if we're no longer in one
    if (inList && !line.trim().startsWith('-') && !line.trim().match(/^\d+\. /)) {
      flushList();
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      return;
    }

    // Regular paragraph
    if (line.trim()) {
      flushList();
      elements.push(
        <p key={`p-${index}`} className="mb-2 leading-relaxed">
          {formatInlineMarkdown(line, isBot)}
        </p>
      );
    }
  });

  flushList();

  return <div className="markdown-content">{elements}</div>;
};

// Format inline markdown (bold, italic, code)
const formatInlineMarkdown = (text, isBot) => {
  const parts = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    // Bold **text**
    if (text.substr(i, 2) === '**') {
      if (current) parts.push(current);
      current = '';
      i += 2;
      let bold = '';
      while (i < text.length && text.substr(i, 2) !== '**') {
        bold += text[i];
        i++;
      }
      parts.push(<strong key={`b-${i}`} className="font-bold">{bold}</strong>);
      i += 2;
      continue;
    }

    // Inline code `text`
    if (text[i] === '`' && text[i-1] !== '\\') {
      if (current) parts.push(current);
      current = '';
      i++;
      let code = '';
      while (i < text.length && text[i] !== '`') {
        code += text[i];
        i++;
      }
      parts.push(
        <code key={`c-${i}`} className={`px-1.5 py-0.5 rounded text-sm font-mono ${
          isBot ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'
        }`}>{code}</code>
      );
      i++;
      continue;
    }

    current += text[i];
    i++;
  }

  if (current) parts.push(current);
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
};

function ChatPage() {
  const { user } = useAuthStore()
  const { 
    conversations, 
    activeConversation, 
    messages, 
    setConversations, 
    setActiveConversation, 
    setMessages, 
    addMessage,
    upsertConversation,
    removeConversation,
    unreadConversationIds, // Okunmamış ID'leri al
    addUnread,             // Yeni fonksiyonları al
    markAsRead,
    assignAgentToConversation // Store'dan yeni fonksiyonu al
  } = useChatStore()
  const [messageInput, setMessageInput] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  const [isUploading, setIsUploading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState(''); // Streaming mesaj için
  const messagesEndRef = useRef(null)
  const audioRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Ses elementini oluştur
    audioRef.current = new Audio('/notification.mp3'); // Basit bir bildirim sesi
    audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    loadConversations()
    
    // Socket bağlantısı kur (site_id olmasa bile bağlan)
    if (user?.id) {
      socketService.connect(user.id, user.site_id || null)
    }

    // Yeni mesaj geldiğinde
    socketService.on('message:received', (message) => {
      if (message.conversationId === useChatStore.getState().activeConversation) {
        addMessage(message)
        setStreamingMessage('') // Streaming mesajı temizle
        scrollToBottom()
      }
    })

    // Streaming mesaj parçası geldiğinde
    socketService.on('message:chunk', (data) => {
      if (data.conversationId === useChatStore.getState().activeConversation) {
        setStreamingMessage(prev => prev + data.chunk)
        scrollToBottom()
      }
    })

    const handleNewEvent = (conversation) => {
      // Konuşmayı her durumda güncelle
      upsertConversation(conversation);
      
      // Eğer sohbet aktif değilse, okunmamış olarak işaretle ve ses çal
      if (useChatStore.getState().activeConversation !== conversation.id) {
        addUnread(conversation.id);
        audioRef.current?.play().catch(e => console.error("Ses çalınamadı:", e));
      }
    };

    // Yeni konuşma geldiğinde
    socketService.on('conversation:new', (conversation) => {
      toast.success(`Yeni sohbet: ${conversation.visitor_name}`)
      handleNewEvent(conversation);
    })

    // Konuşma güncellendiğinde (yeni mesaj vs)
    socketService.on('conversation:update', (conversation) => {
      handleNewEvent(conversation);
    })

    // Konuşma kapatıldığında listeden kaldır
    socketService.on('conversation:closed', ({ conversationId }) => {
      removeConversation(conversationId)
      toast.success('Bir sohbet kapatıldı.')
    })

    // Konuşma silindiğinde listeden kaldır
    socketService.on('conversation:deleted', ({ conversationId }) => {
      removeConversation(conversationId)
      toast('Bir sohbet kalıcı olarak silindi.', { icon: '🗑️' })
    })

    // Bir sohbete ajan atandığında
    socketService.on('conversation:assigned', ({ conversationId, agentId, agentName }) => {
      assignAgentToConversation(conversationId, agentId, agentName);
    });

    return () => {
      socketService.removeAllListeners()
    }
  }, [user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConversations = async () => {
    try {
      const response = await chatApi.getConversations({ status: 'open' })
      setConversations(response.data.conversations)
    } catch (error) {
      toast.error('Konuşmalar yüklenemedi')
    }
  }

  const selectConversation = async (conversationId) => {
    setActiveConversation(conversationId)
    markAsRead(conversationId); // Okundu olarak işaretle
    setAiSuggestion(null)
    
    try {
      const response = await chatApi.getMessages(conversationId)
      setMessages(response.data.messages)
    } catch (error) {
      toast.error('Mesajlar yüklenemedi')
    }
  }

  const sendMessage = (attachments = null) => {
    const messageBody = messageInput.trim();
    if (!messageBody && !attachments) return;

    // Socket'e gönder
    socketService.sendMessage(activeConversation, messageBody, attachments);
    
    // UI'ye anlık ekle (optimistic update)
    const newMessage = {
      sender_type: 'agent',
      body: messageBody,
      attachments: attachments,
      created_at: new Date().toISOString()
    };
    addMessage(newMessage);
    
    setMessageInput('');
    setAiSuggestion(null);
    scrollToBottom();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsUploading(true);

    try {
      // Bu API call'ı api.js'de tanımlamalıyız.
      const response = await chatApi.uploadFile(formData); 
      sendMessage([response.data.file]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Dosya yüklenemedi.');
    } finally {
      setIsUploading(false);
      // Input'u sıfırla ki aynı dosya tekrar seçilebilsin
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getAiSuggestion = async () => {
    if (!activeConversation || messages.length === 0) return

    setIsLoadingSuggestion(true)
    try {
      const lastVisitorMessage = messages.filter(m => m.sender_type === 'visitor').pop()
      if (!lastVisitorMessage) return

      const response = await ragApi.getSuggestion(activeConversation, lastVisitorMessage.body)
      setAiSuggestion(response.data.suggestion)
    } catch (error) {
      toast.error('AI önerisi alınamadı')
    } finally {
      setIsLoadingSuggestion(false)
    }
  }

  const useAiSuggestion = () => {
    if (aiSuggestion) {
      setMessageInput(aiSuggestion)
      setAiSuggestion(null)
    }
  }

  const handleCloseConversation = async () => {
    if (!activeConversation) return;

    try {
      await chatApi.closeConversation(activeConversation);
      // Socket eventi zaten listeden kaldıracak, ama anında UI tepkisi için burada da çağırabiliriz.
      // removeConversation(activeConversation); 
      toast.success('Sohbet başarıyla kapatıldı.');
    } catch (error) {
      toast.error('Sohbet kapatılamadı.');
    }
  };

  const handleAssignToMe = async (conversationId) => {
    try {
      await chatApi.assignAgent(conversationId, user.id);
      // UI anında socket eventi ile güncellenecek
      toast.success('Sohbet size atandı.');
    } catch (error) {
      toast.error('Sohbet atanamadı.');
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (window.confirm('Bu sohbeti kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      try {
        await chatApi.deleteConversation(conversationId);
        toast.success('Sohbet silindi.');
        // UI anında socket eventi ile güncellenecek
      } catch (error) {
        toast.error('Sohbet silinemedi.');
      }
    }
  };

  // Yazma durumunu yönet
  const handleTyping = (e) => {
    setMessageInput(e.target.value);

    // Eğer timeout zaten varsa, temizle ve baştan başlat
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      // Eğer ilk defa yazmaya başlıyorsa, 'start' sinyali gönder
      socketService.startTyping(activeConversation);
    }

    // Kullanıcı yazmayı bıraktıktan 1.5 saniye sonra 'stop' sinyali gönder
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(activeConversation);
      typingTimeoutRef.current = null;
    }, 1500);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex h-screen">
      {/* Konuşma Listesi */}
      <div className="w-80 bg-white border-r">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Sohbetler</h2>
        </div>

        <div className="overflow-y-auto h-full">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz sohbet yok
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`p-4 border-b cursor-pointer group hover:bg-gray-50 relative ${
                  activeConversation === conv.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                }`}
              >
                {unreadConversationIds.has(conv.id) && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                )}
                <div className="flex justify-between items-start ml-4">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${unreadConversationIds.has(conv.id) ? 'font-bold' : ''}`}>
                      {conv.visitor_name || 'Misafir'}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
                    {conv.agent_name ? (
                      <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                        {conv.agent_name}
                      </span>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignToMe(conv.id);
                        }}
                        className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full mt-1 inline-block hover:bg-blue-200"
                      >
                        Sahiplen
                      </button>
                    )}
                  </div>
                  <div className="flex items-center">
                    {user?.role === 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Üstteki div'in click event'ini tetiklemesini engelle
                          handleDeleteConversation(conv.id);
                        }}
                        className="p-1 text-gray-400 rounded-full hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Sohbeti Sil"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                    {conv.last_message_time && (
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true, locale: tr })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mesaj Alanı */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-white">
              <h3 className="font-semibold text-lg">
                {conversations.find(c => c.id === activeConversation)?.visitor_name || 'Misafir'}
              </h3>
              <button
                onClick={handleCloseConversation}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                <FiXCircle />
                Sohbeti Kapat
              </button>
            </div>

            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-4 flex ${['agent', 'bot'].includes(msg.sender_type) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      ['agent', 'bot'].includes(msg.sender_type)
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-800 shadow'
                    }`}
                    style={{ fontSize: '15px', lineHeight: '1.6' }}
                  >
                    {msg.body && (
                      <div className={['agent', 'bot'].includes(msg.sender_type) ? 'text-white' : 'text-gray-800'}>
                        <MarkdownText text={msg.body} isBot={['agent', 'bot'].includes(msg.sender_type)} />
                      </div>
                    )}
                    {msg.attachments && (
                      <div className="mt-2">
                        {msg.attachments.map((file, idx) => (
                          <AttachmentPreview key={idx} file={file} />
                        ))}
                      </div>
                    )}
                    <p className="text-xs mt-1 opacity-70 text-right">
                      {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {streamingMessage && (
                <div className="mb-4 flex justify-end">
                  <div
                    className="max-w-2xl px-4 py-3 rounded-lg bg-primary-600 text-white"
                    style={{ fontSize: '15px', lineHeight: '1.6' }}
                  >
                    <div className="text-white">
                      <MarkdownText text={streamingMessage} isBot={true} />
                    </div>
                    <div className="inline-block w-2 h-4 bg-white animate-pulse ml-1"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Öneri */}
            {aiSuggestion && (
              <div className="bg-yellow-50 border-t border-yellow-200 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 mb-1">🤖 AI Önerisi:</p>
                    <p className="text-sm text-gray-700">{aiSuggestion}</p>
                  </div>
                  <button
                    onClick={useAiSuggestion}
                    className="ml-2 px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                  >
                    Kullan
                  </button>
                </div>
              </div>
            )}

            {/* Mesaj Gönderme */}
            <div className="bg-white border-t p-4">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={getAiSuggestion}
                  disabled={isLoadingSuggestion}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                >
                  <FiZap />
                  {isLoadingSuggestion ? 'Öneri alınıyor...' : 'AI Öneri Al'}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleTyping} // onChange event'ini yeni fonksiyona bağla
                  onKeyPress={handleKeyPress}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  disabled={isUploading}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                  title="Dosya Ekle"
                >
                  {isUploading ? <FiRefreshCw className="animate-spin" /> : <FiPaperclip />}
                </button>
                <button
                  onClick={() => sendMessage()}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <FiSend />
                  Gönder
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Bir sohbet seçin</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatPage



