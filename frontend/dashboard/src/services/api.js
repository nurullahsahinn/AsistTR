/**
 * API Service
 * Backend API çağrıları
 */

import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

// Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - Token ekle
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - Hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      toast.error('Oturumunuz sonlandı, lütfen tekrar giriş yapın')
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  
  register: (name, email, password) =>
    api.post('/auth/register', { name, email, password }),
  
  getMe: () => 
    api.get('/auth/me'),
}

// Chat API
export const chatApi = {
  // Konuşmaları listele
  getConversations: (params) => api.get('/chat', { params }),
  // Mesajları getir
  getMessages: (conversationId) => api.get(`/chat/${conversationId}/messages`),
  // Konuşmayı kapat
  closeConversation: (conversationId, rating) => api.post(`/chat/${conversationId}/close`, { rating }),
  // Agent ata
  assignAgent: (conversationId, agentId) => api.post(`/chat/${conversationId}/assign`, { agentId }),
  // Konuşmayı sil (Admin)
  deleteConversation: (conversationId) => api.delete(`/chat/${conversationId}`),
  // Dosya Yükle
  uploadFile: (formData) => api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

export const userApi = {
  // Kullanıcıları listele (Admin)
  listUsers: () => api.get('/users'),
  // Yeni kullanıcı oluştur (Admin)
  createUser: (userData) => api.post('/users', userData),
  // Kullanıcıyı güncelle (Admin)
  updateUser: (userId, userData) => api.put(`/users/${userId}`, userData),
  // Kullanıcıyı sil (Admin)
  deleteUser: (userId) => api.delete(`/users/${userId}`),
};

// Widget/Site API
export const siteApi = {
  getSites: () =>
    api.get('/widget/sites'),
  
  createSite: (data) =>
    api.post('/widget/sites', data),
  
  updateSettings: (siteId, settings) =>
    api.put(`/widget/sites/${siteId}/settings`, { settings }),
}

// RAG API
export const ragApi = {
  getKnowledge: (siteId) =>
    api.get('/rag/knowledge', { params: { siteId } }),
  
  createKnowledge: (data) =>
    api.post('/rag/knowledge', data),
  
  updateKnowledge: (id, data) =>
    api.put(`/rag/knowledge/${id}`, data),
  
  deleteKnowledge: (id) =>
    api.delete(`/rag/knowledge/${id}`),
  
  bulkCreate: (siteId, items) =>
    api.post('/rag/knowledge/bulk', { siteId, items }),
  
  generateAnswer: (conversationId, message) =>
    api.post('/rag/generate', { conversationId, message }),
  
  getSuggestion: (conversationId, visitorMessage) =>
    api.post('/rag/suggest', { conversationId, visitorMessage }),
  
  checkHealth: () =>
    api.get('/rag/health'),
}

// Voice Call API
export const voiceApi = {
  updateCallAvailability: (availableForCalls, maxConcurrentCalls = 1) =>
    api.post('/voice/availability', { availableForCalls, maxConcurrentCalls }),
  
  acceptCall: (voiceCallId) =>
    api.post(`/voice/${voiceCallId}/accept`),
  
  rejectCall: (voiceCallId) =>
    api.post(`/voice/${voiceCallId}/reject`),
  
  endCall: (voiceCallId, reason = 'user_hangup') =>
    api.post(`/voice/${voiceCallId}/end`, { reason }),
  
  getActiveCalls: (siteId) =>
    api.get('/voice/active', { params: { siteId } }),
  
  getCallHistory: (conversationId) =>
    api.get(`/voice/conversation/${conversationId}/history`),
}

// Canned Responses API
export const cannedApi = {
  getCannedResponses: (params) => api.get('/canned', { params }),
  createCannedResponse: (data) => api.post('/canned', data),
  updateCannedResponse: (id, data) => api.put(`/canned/${id}`, data),
  deleteCannedResponse: (id) => api.delete(`/canned/${id}`),
}

// Analytics API
export const analyticsApi = {
  getDashboard: (params) => api.get('/analytics/dashboard', { params }),
  getTopPages: (params) => api.get('/analytics/top-pages', { params }),
  getTrafficSources: (params) => api.get('/analytics/traffic-sources', { params }),
  getDeviceStats: (params) => api.get('/analytics/device-stats', { params }),
  getConversationMetrics: (params) => api.get('/analytics/conversation-metrics', { params }),
  getAgentPerformance: (params) => api.get('/analytics/agent-performance', { params }),
}

// Departments API
export const departmentApi = {
  getDepartments: () => api.get('/departments'),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),
}

// Agents API
export const agentApi = {
  getAgents: (params) => api.get('/agents', { params }),
  createAgent: (data) => api.post('/agents', data),
  updateAgent: (id, data) => api.put(`/agents/${id}`, data),
  deleteAgent: (id) => api.delete(`/agents/${id}`),
  updateStatus: (status) => api.post('/agents/status', { status }),
  getPresence: () => api.get('/agents/presence'),
}

// Notifications API
export const notificationApi = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (preferences) => api.put('/notifications/preferences', preferences),
  getNotifications: (params) => api.get('/notifications', { params }),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
}

// Chat Enhancement API (Tags, Notes, Ratings, Transfer)
export const chatEnhancementApi = {
  // Tags
  getTags: (siteId) => api.get('/chat/tags', { params: { siteId } }),
  createTag: (data) => api.post('/chat/tags', data),
  addTagToConversation: (conversationId, tagId) => api.post('/chat/tags/add', { conversationId, tagId }),
  removeTagFromConversation: (conversationId, tagId) => api.delete(`/chat/tags/${conversationId}/${tagId}`),
  getConversationTags: (conversationId) => api.get(`/chat/${conversationId}/tags`),
  
  // Notes
  getConversationNotes: (conversationId) => api.get(`/chat/${conversationId}/notes`),
  createNote: (conversationId, note) => api.post(`/chat/${conversationId}/notes`, { note }),
  updateNote: (noteId, note) => api.put(`/chat/notes/${noteId}`, { note }),
  deleteNote: (noteId) => api.delete(`/chat/notes/${noteId}`),
  
  // Ratings
  submitRating: (conversationId, rating, comment) => api.post(`/chat/${conversationId}/rating`, { rating, comment }),
  
  // Transfer
  transferConversation: (conversationId, targetAgentId, targetDepartmentId) => 
    api.post(`/chat/${conversationId}/transfer`, { targetAgentId, targetDepartmentId }),
}

// Queue API
export const queueApi = {
  getQueueStatus: (siteId) => api.get('/queue/status', { params: { siteId } }),
  removeFromQueue: (queueId) => api.delete(`/queue/${queueId}`),
  getQueueStats: (siteId, period = '7d') => api.get('/queue/stats', { params: { siteId, period } }),
}

// Offline Messages API
export const offlineMessageApi = {
  getOfflineMessages: (siteId, status = 'pending') => api.get('/offline-messages', { params: { siteId, status } }),
  updateMessageStatus: (messageId, status) => api.put(`/offline-messages/${messageId}/status`, { status }),
  deleteOfflineMessage: (messageId) => api.delete(`/offline-messages/${messageId}`),
}

// Presence API
export const presenceApi = {
  getAgents: (siteId) => api.get('/presence/agents', { params: { siteId } }),
  updateStatus: (status) => api.post('/presence/status', { status }),
}

// Agent State API (Break management)
export const agentStateApi = {
  getAgentState: () => api.get('/agent-state/state'),
  updateAgentState: (state, reason) => api.put('/agent-state/state', { state, reason }),
  getAllAgentsStates: (siteId) => api.get('/agent-state/states/all', { params: { siteId } }),
  startBreak: (breakType, reason) => api.post('/agent-state/break/start', { breakType, reason }),
  endBreak: () => api.post('/agent-state/break/end'),
}

// Metrics API
export const metricsApi = {
  getConversationMetrics: (conversationId) => api.get(`/metrics/conversation/${conversationId}`),
  getAgentMetrics: (agentId, period = '7d') => api.get(`/metrics/agent/${agentId}`, { params: { period } }),
}

// Export both named and default
export { api }
export default api



