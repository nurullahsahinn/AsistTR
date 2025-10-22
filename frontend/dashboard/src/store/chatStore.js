/**
 * Chat Store (Zustand)
 * Sohbet ve mesaj state yönetimi
 */

import { create } from 'zustand'

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoading: false,
  
  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),
  
  setActiveConversation: (conversationId) => set({ 
    activeConversation: conversationId,
    messages: []
  }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    )
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  clearMessages: () => set({ messages: [] }),
}))

