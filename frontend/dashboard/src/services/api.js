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

export default api



