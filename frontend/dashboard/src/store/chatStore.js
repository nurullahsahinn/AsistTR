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
  unreadConversationIds: new Set(), // Okunmamış sohbet ID'lerini tutacak

  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations]
  })),

  // Yeni gelen konuşmayı listeye ekle (eğer zaten yoksa)
  upsertConversation: (conversation) => set((state) => {
    const existingIndex = state.conversations.findIndex(c => c.id === conversation.id);
    if (existingIndex > -1) {
      // Eğer varsa, güncelle ve en üste taşı
      const updatedConversations = [...state.conversations];
      const existingConversation = updatedConversations.splice(existingIndex, 1)[0];
      return {
        conversations: [{ ...existingConversation, ...conversation }, ...updatedConversations]
      };
    } else {
      // Eğer yoksa, en üste ekle
      return {
        conversations: [conversation, ...state.conversations]
      };
    }
  }),

  // Bir sohbete ajan ata
  assignAgentToConversation: (conversationId, agentId, agentName) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === conversationId ? { ...c, agent_id: agentId, agent_name: agentName } : c
    )
  })),

  // Konuşmayı listeden kaldır
  removeConversation: (conversationId) => set((state) => ({
    conversations: state.conversations.filter(c => c.id !== conversationId),
    // Eğer kapatılan sohbet aktif ise, aktif sohbeti temizle
    activeConversation: state.activeConversation === conversationId ? null : state.activeConversation
  })),
  
  // Okunmamış olarak işaretle
  addUnread: (conversationId) => set((state) => ({
    unreadConversationIds: new Set(state.unreadConversationIds).add(conversationId)
  })),

  // Okundu olarak işaretle
  markAsRead: (conversationId) => set((state) => {
    const newUnreadIds = new Set(state.unreadConversationIds);
    newUnreadIds.delete(conversationId);
    return { unreadConversationIds: newUnreadIds };
  }),

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



