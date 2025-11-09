import { useState, useEffect, useRef } from 'react'
import { chatApi, ragApi, api } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import socketService from '../services/socket'
import toast from 'react-hot-toast'
import { FiSend, FiZap, FiXCircle, FiTrash2, FiPaperclip, FiDownload, FiRefreshCw, FiTag, FiFileText, FiStar, FiUsers, FiPhone, FiPhoneOff, FiPhoneIncoming } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { userApi } from '../services/api'
import VoiceCallPanel from '../components/VoiceCallPanel'

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
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [cannedResponses, setCannedResponses] = useState([]);
  const [tags, setTags] = useState([]);
  const [conversationTags, setConversationTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showRating, setShowRating] = useState(false);
  const [agents, setAgents] = useState([]);
  const [showTransfer, setShowTransfer] = useState(false);
  
  // Voice call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeVoiceCall, setActiveVoiceCall] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, ringing, connecting, connected
  const [callDuration, setCallDuration] = useState(0); // Arama süresi (saniye)
  const callTimerRef = useRef(null);
  
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

    // Socket listener'larını tanımla
    const handleMessageReceived = (message) => {
      if (message.conversationId === useChatStore.getState().activeConversation) {
        // Backend'den gelen mesajı normalize et
        const normalizedMessage = {
          id: message.id,
          sender_type: message.senderType,
          sender_id: message.sender_id,
          body: message.body,
          attachments: message.attachments,
          created_at: message.createdAt
        };
        
        addMessage(normalizedMessage);
        setStreamingMessage(''); // Streaming mesajı temizle
        scrollToBottom();
      }
      
      // ✅ Conversation listesini güncelle ve en üste taşı
      useChatStore.getState().updateOrAddConversation({
        id: message.conversationId,
        last_message: message.body?.substring(0, 100),
        last_message_time: message.createdAt || new Date().toISOString()
      });
    };

    const handleMessageChunk = (data) => {
      if (data.conversationId === useChatStore.getState().activeConversation) {
        setStreamingMessage(prev => prev + data.chunk)
        scrollToBottom()
      }
    };

    const handleNewEvent = (conversation) => {
      // Konuşmayı her durumda güncelle
      upsertConversation(conversation);
      
      // Eğer sohbet aktif değilse, okunmamış olarak işaretle ve ses çal
      if (useChatStore.getState().activeConversation !== conversation.id) {
        addUnread(conversation.id);
        audioRef.current?.play().catch(e => console.error("Ses çalınamadı:", e));
      }
    };

    const handleConversationNew = (conversation) => {
      toast.success(`Yeni sohbet: ${conversation.visitor_name}`)
      handleNewEvent(conversation);
    };

    const handleConversationUpdate = (conversation) => {
      handleNewEvent(conversation);
    };

    const handleConversationClosed = ({ conversationId }) => {
      removeConversation(conversationId)
      toast.success('Bir sohbet kapatıldı.')
    };

    const handleConversationDeleted = ({ conversationId }) => {
      removeConversation(conversationId)
      toast('Bir sohbet kalıcı olarak silindi.', { icon: '🗑️' })
    };

    const handleConversationAssigned = ({ conversationId, agentId, agentName }) => {
      assignAgentToConversation(conversationId, agentId, agentName);
    };
    
    // Voice call events
    const handleIncomingCall = (data) => {
      console.log('Incoming call:', data);
      setIncomingCall(data);
      audioRef.current?.play().catch(e => console.error("Ses çalınamadı:", e));
      toast('Gelen sesli çağrı!', { icon: '📞' });
    };
    
    const handleCallAccepted = (data) => {
      console.log('Call accepted:', data);
      setCallStatus('connecting');
    };
    
    const handleWebRTCOffer = async (data) => {
      console.log('WebRTC offer received:', data);
      try {
        // If peer connection doesn't exist yet, create it
        if (!peerConnection && activeVoiceCall) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(stream);
          await setupPeerConnection(stream, activeVoiceCall.voiceCallId, activeVoiceCall.conversationId);
        }
        
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          socketService.socket.emit('voice:webrtc:answer', {
            voiceCallId: activeVoiceCall.voiceCallId,
            conversationId: activeVoiceCall.conversationId,
            answer: peerConnection.localDescription
          });
          
          console.log('WebRTC answer sent');
        }
      } catch (error) {
        console.error('WebRTC offer handling error:', error);
        toast.error('WebRTC bağlantı hatası');
        await endCall();
      }
    };
    
    const handleWebRTCAnswer = async (data) => {
      console.log('WebRTC answer received');
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };
    
    const handleICECandidate = async (data) => {
      console.log('ICE candidate received');
      if (peerConnection && data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };
    
    const handleCallEnded = (data) => {
      console.log('Call ended:', data);
      setIncomingCall(null); // ✅ Incoming call'u temizle
      endCall();
    };

    // Listener'ları ekle
    socketService.on('message:received', handleMessageReceived);
    socketService.on('message:chunk', handleMessageChunk);
    socketService.on('conversation:new', handleConversationNew);
    socketService.on('conversation:update', handleConversationUpdate);
    socketService.on('conversation:closed', handleConversationClosed);
    socketService.on('conversation:deleted', handleConversationDeleted);
    socketService.on('conversation:assigned', handleConversationAssigned);
    socketService.on('voice:call:incoming', handleIncomingCall);
    socketService.on('voice:call:accepted', handleCallAccepted);
    socketService.on('voice:webrtc:offer', handleWebRTCOffer);
    socketService.on('voice:webrtc:answer', handleWebRTCAnswer);
    socketService.on('voice:webrtc:ice-candidate', handleICECandidate);
    socketService.on('voice:call:ended', handleCallEnded);

    // Cleanup: listener'ları kaldır
    return () => {
      socketService.off('message:received', handleMessageReceived);
      socketService.off('message:chunk', handleMessageChunk);
      socketService.off('conversation:new', handleConversationNew);
      socketService.off('conversation:update', handleConversationUpdate);
      socketService.off('conversation:closed', handleConversationClosed);
      socketService.off('conversation:deleted', handleConversationDeleted);
      socketService.off('conversation:assigned', handleConversationAssigned);
      socketService.off('voice:call:incoming', handleIncomingCall);
      socketService.off('voice:call:accepted', handleCallAccepted);
      socketService.off('voice:webrtc:offer', handleWebRTCOffer);
      socketService.off('voice:webrtc:answer', handleWebRTCAnswer);
      socketService.off('voice:webrtc:ice-candidate', handleICECandidate);
      socketService.off('voice:call:ended', handleCallEnded);
    }
  }, [user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  // ✅ Call duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      // Timer başlat
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      // Timer durdur ve sıfırla
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (callStatus === 'idle') {
        setCallDuration(0);
      }
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus])

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
    
    // Agent conversation room'una katıl
    socketService.joinConversation(conversationId, user.id);
    
    try {
      const response = await chatApi.getMessages(conversationId)
      setMessages(response.data.messages)
      
      // Load additional data
      loadConversationTags(conversationId)
      loadConversationNotes(conversationId)
    } catch (error) {
      toast.error('Mesajlar yüklenemedi')
    }
  }

  const sendMessage = (attachments = null) => {
    const messageBody = messageInput.trim();
    if (!messageBody && !attachments) return;

    // Socket'e gönder
    socketService.sendMessage(activeConversation, messageBody, attachments);
    
    // Sol taraftaki conversation listesini güncelle
    const updatedConv = conversations.find(c => c.id === activeConversation);
    if (updatedConv) {
      upsertConversation({
        ...updatedConv,
        last_message: messageBody,
        last_message_time: new Date().toISOString()
      });
    }
    
    setMessageInput('');
    setAiSuggestion(null);
    // Backend'den mesaj gelince scroll olacak
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
    const value = e.target.value;
    setMessageInput(value);

    // Check for canned response shortcut
    if (value.startsWith('/')) {
      setShowCannedResponses(true);
      if (cannedResponses.length === 0) loadCannedResponses();
    } else {
      setShowCannedResponses(false);
    }

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

  // Load canned responses
  const loadCannedResponses = async () => {
    try {
      const { data } = await api.get('/canned');
      setCannedResponses(data.cannedResponses || []);
    } catch (error) {
      console.error('Failed to load canned responses:', error);
    }
  };

  // Use canned response
  const useCannedResponse = (content) => {
    setMessageInput(content);
    setShowCannedResponses(false);
  };

  // Load conversation tags
  const loadConversationTags = async (conversationId) => {
    try {
      const { data } = await api.get(`/api/chat-enhancement/conversations/${conversationId}/tags`);
      setConversationTags(data.tags || []);
      
      // Also load all available tags if not loaded
      if (tags.length === 0) {
        const tagsRes = await api.get('/chat-enhancement/tags');
        setTags(tagsRes.data.tags || []);
      }
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  // Add tag to conversation
  const addTag = async (tagId) => {
    try {
      await api.post('/chat-enhancement/tags/assign', {
        conversationId: activeConversation,
        tagId
      });
      loadConversationTags(activeConversation);
      toast.success('Tag added');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add tag');
    }
  };

  // Remove tag
  const removeTag = async (tagId) => {
    try {
      await api.delete(`/api/chat-enhancement/tags/${activeConversation}/${tagId}`);
      loadConversationTags(activeConversation);
      toast.success('Tag removed');
    } catch (error) {
      toast.error('Failed to remove tag');
    }
  };

  // Load conversation notes
  const loadConversationNotes = async (conversationId) => {
    try {
      const { data } = await api.get(`/api/chat-enhancement/conversations/${conversationId}/notes`);
      setNotes(data.notes || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  // Add note
  const addNote = async (noteText) => {
    if (!noteText.trim()) return;
    
    try {
      await api.post(`/api/chat-enhancement/conversations/${activeConversation}/notes`, {
        note: noteText
      });
      loadConversationNotes(activeConversation);
      toast.success('Note added');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  // Submit rating
  const submitRating = async (rating, comment) => {
    try {
      await api.post(`/api/chat-enhancement/conversations/${activeConversation}/rating`, {
        rating,
        feedback_comment: comment
      });
      toast.success('Rating submitted');
      setShowRating(false);
    } catch (error) {
      toast.error('Failed to submit rating');
    }
  };

  // Transfer chat
  const transferChat = async (toAgentId, reason) => {
    try {
      await api.post(`/api/chat-enhancement/conversations/${activeConversation}/transfer`, {
        toAgentId,
        reason
      });
      toast.success('Chat transferred successfully');
      setShowTransfer(false);
      // Reload conversations
      loadConversations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to transfer chat');
    }
  };

  // Load agents for transfer
  const loadAgents = async () => {
    try {
      const { data } = await api.get('/agents');
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  // ===== Voice Call Functions =====
  
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  // Accept incoming call
  const acceptCall = async (voiceCallId, conversationId) => {
    try {
      setCallStatus('connecting');
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      
      // Accept call on backend (✅ API instance kullan - Authorization otomatik)
      const response = await api.post(`/voice/${voiceCallId}/accept`);
      
      setActiveVoiceCall(response.data);
      setIncomingCall(null);
      
      // Setup WebRTC
      await setupPeerConnection(stream, voiceCallId, conversationId);
      
      toast.success('Çağrı bağlandı');
      
    } catch (error) {
      console.error('Accept call error:', error);
      toast.error('Çağrı kabul edilemedi');
      setCallStatus('idle');
    }
  };
  
  // Reject incoming call
  const rejectCall = async (voiceCallId) => {
    try {
      await api.post(`/voice/${voiceCallId}/reject`);
      
      setIncomingCall(null);
      toast('Çağrı reddedildi', { icon: 'ℹ️' });
      
    } catch (error) {
      console.error('Reject call error:', error);
    }
  };
  
  // Setup WebRTC peer connection
  const setupPeerConnection = async (stream, voiceCallId, conversationId) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      
      // Add local stream
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('✅ Remote track received, audio will play');
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play();
        
        // ✅ Track geldi, connection başarılı!
        setCallStatus('connected');
        toast.success('🎤 Ses bağlantısı kuruldu');
      };
      
      // ✅ Connection state değişikliklerini izle
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          toast.error('Bağlantı kesildi');
          endCall();
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.socket.emit('voice:webrtc:ice-candidate', {
            voiceCallId,
            conversationId,
            candidate: event.candidate
          });
        }
      };
      
      setPeerConnection(pc);
      setCallStatus('connected');
      
    } catch (error) {
      console.error('Peer connection setup error:', error);
      await endCall();
    }
  };
  
  // End call
  const endCall = async () => {
    try {
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      // Close peer connection
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      
      // Notify backend (✅ API instance kullan)
      if (activeVoiceCall) {
        await api.post(`/voice/${activeVoiceCall.voiceCallId}/end`, { 
          reason: 'agent_hangup' 
        });
      }
      
      setActiveVoiceCall(null);
      setCallStatus('idle');
      toast('Çağrı sonlandırıldı', { icon: '📞' });
      
    } catch (error) {
      console.error('End call error:', error);
    }
  };

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
              {/* Canned Responses Dropdown */}
              {showCannedResponses && cannedResponses.length > 0 && (
                <div className="mb-2 max-h-48 overflow-y-auto bg-gray-50 border rounded-lg">
                  {cannedResponses
                    .filter(cr => cr.shortcut?.startsWith(messageInput) || cr.title.toLowerCase().includes(messageInput.slice(1).toLowerCase()))
                    .slice(0, 5)
                    .map(cr => (
                      <button
                        key={cr.id}
                        onClick={() => useCannedResponse(cr.content)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{cr.title}</span>
                          {cr.shortcut && <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">{cr.shortcut}</code>}
                        </div>
                        <p className="text-xs text-gray-600 truncate">{cr.content}</p>
                      </button>
                    ))
                  }
                </div>
              )}
              
              <div className="flex gap-2 mb-2">
                <button
                  onClick={getAiSuggestion}
                  disabled={isLoadingSuggestion}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                >
                  <FiZap />
                  {isLoadingSuggestion ? 'Öneri alınıyor...' : 'AI Öneri Al'}
                </button>
                <button
                  onClick={() => { setShowTransfer(true); loadAgents(); }}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  <FiUsers />
                  Transfer
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={handleTyping} // onChange event'ini yeni fonksiyona bağla
                  onKeyPress={handleKeyPress}
                  placeholder="Mesajınızı yazın... (/ için şablonlar)"
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

      {/* Right Sidebar - Tags, Notes, Actions */}
      {activeConversation && (
        <div className="w-80 bg-white border-l overflow-y-auto">
          {/* Tags Section */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FiTag /> Tags
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {conversationTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => removeTag(tag.tag_id)}
                    className="hover:opacity-70"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <select
              onChange={(e) => { if (e.target.value) addTag(e.target.value); e.target.value = ''; }}
              className="w-full text-sm border rounded px-2 py-1"
            >
              <option value="">Add tag...</option>
              {tags.filter(t => !conversationTags.find(ct => ct.tag_id === t.id)).map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>

          {/* Notes Section */}
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <FiFileText /> Internal Notes
            </h3>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {notes.map(note => (
                <div key={note.id} className="bg-yellow-50 p-2 rounded text-sm">
                  <p className="text-gray-700">{note.note}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {note.agent_name} - {new Date(note.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <textarea
                placeholder="Add internal note..."
                className="w-full text-sm border rounded px-2 py-1"
                rows="2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addNote(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Rating Section */}
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <FiStar /> Customer Rating
            </h3>
            <button
              onClick={() => setShowRating(!showRating)}
              className="w-full px-3 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
            >
              Request Rating
            </button>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Transfer Chat</h3>
            <select
              className="w-full border rounded px-3 py-2 mb-4"
              onChange={(e) => {
                if (e.target.value) {
                  transferChat(e.target.value, '');
                }
              }}
            >
              <option value="">Select agent...</option>
              {agents.filter(a => a.id !== user.id).map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} - {agent.online_status}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTransfer(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Voice Call Panel - Yeni Modern UI */}
      <VoiceCallPanel
        incomingCall={incomingCall ? {
          ...incomingCall,
          visitorName: conversations.find(c => c.id === incomingCall.conversationId)?.visitor_name || 'Ziyaretçi'
        } : null}
        onAccept={() => acceptCall(incomingCall?.voiceCallId, incomingCall?.conversationId)}
        onReject={() => rejectCall(incomingCall?.voiceCallId)}
        onEnd={endCall}
        callStatus={callStatus}
        duration={callDuration}
      />
    </div>
  )
}

export default ChatPage



