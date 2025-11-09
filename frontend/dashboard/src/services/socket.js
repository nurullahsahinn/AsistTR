/**
 * Socket.IO Client Service
 * Gerçek zamanlı mesajlaşma
 */

import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000'

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
  }

  connect(agentId, siteId) {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    this.socket.on('connect', () => {
      console.log('✅ Socket bağlandı')
      this.isConnected = true
      
      // Agent olarak bağlan
      this.socket.emit('agent:connect', { agentId, siteId })
    })

    this.socket.on('disconnect', () => {
      console.log('❌ Socket bağlantısı kesildi')
      this.isConnected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket bağlantı hatası:', error)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  // Mesaj gönder
  sendMessage(conversationId, body, attachments = null) {
    if (!this.socket?.connected) {
      console.error('Socket bağlı değil')
      return
    }

    this.socket.emit('message:send', {
      conversationId,
      body,
      senderType: 'agent',
      attachments
    })
  }

  // Conversation'a katıl (agent room'a join)
  joinConversation(conversationId, agentId) {
    if (!this.socket?.connected) {
      console.error('Socket bağlı değil')
      return
    }

    this.socket.emit('agent:join:conversation', {
      conversationId,
      agentId
    })
    console.log(`✅ Agent conversation'a katıldı: ${conversationId}`)
  }

  // Yazıyor bildirimi
  startTyping(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', { conversationId })
    }
  }

  stopTyping(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', { conversationId })
    }
  }

  // Event listener ekle
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  // Event listener kaldır
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  // Tüm listener'ları kaldır
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners()
    }
  }
}

// Singleton instance
const socketService = new SocketService()

export default socketService




