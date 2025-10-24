import { useState, useEffect, useRef } from 'react'
import { chatApi, ragApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import socketService from '../services/socket'
import toast from 'react-hot-toast'
import { FiSend, FiRefreshCw, FiZap } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

function ChatPage() {
  const { user } = useAuthStore()
  const { conversations, activeConversation, messages, setConversations, setActiveConversation, setMessages, addMessage } = useChatStore()
  const [messageInput, setMessageInput] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadConversations()
    
    // Socket bağlantısı kur
    if (user?.id) {
      socketService.connect(user.id, 'site-id-buraya')
    }

    // Yeni mesaj geldiğinde
    socketService.on('message:received', (message) => {
      addMessage(message)
      scrollToBottom()
    })

    // Yeni konuşma
    socketService.on('conversation:new', (data) => {
      toast.success('Yeni sohbet başladı!')
      loadConversations()
    })

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
    setAiSuggestion(null)
    
    try {
      const response = await chatApi.getMessages(conversationId)
      setMessages(response.data.messages)
    } catch (error) {
      toast.error('Mesajlar yüklenemedi')
    }
  }

  const sendMessage = () => {
    if (!messageInput.trim() || !activeConversation) return

    socketService.sendMessage(activeConversation, messageInput)
    setMessageInput('')
    setAiSuggestion(null)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex h-screen">
      {/* Konuşma Listesi */}
      <div className="w-80 bg-white border-r">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Sohbetler</h2>
            <button onClick={loadConversations} className="p-2 hover:bg-gray-100 rounded">
              <FiRefreshCw />
            </button>
          </div>
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
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  activeConversation === conv.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold">{conv.visitor_name || 'Misafir'}</p>
                    <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
                  </div>
                  {conv.last_message_time && (
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true, locale: tr })}
                    </span>
                  )}
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
            {/* Mesajlar */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-4 flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      msg.sender_type === 'agent'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-800 shadow'
                    }`}
                  >
                    <p>{msg.body}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
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
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <button
                  onClick={sendMessage}
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


