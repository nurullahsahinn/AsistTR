import { useState, useEffect } from 'react'
import { siteApi, chatApi, ragApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { FiMessageCircle, FiUsers, FiCheckCircle, FiClock, FiShield } from 'react-icons/fi'
import toast from 'react-hot-toast'
import QueueMonitor from '../components/QueueMonitor'
import PerformanceMetrics from '../components/PerformanceMetrics'

function DashboardPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  
  const [sites, setSites] = useState([])
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeConversations: 0,
    closedConversations: 0,
    avgResponseTime: '0'
  })
  const [ollamaStatus, setOllamaStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Site listesi
      const sitesRes = await siteApi.getSites()
      setSites(sitesRes.data.sites)

      // Konuşma istatistikleri
      const convRes = await chatApi.getConversations({ status: 'open' })
      const conversations = convRes.data.conversations
      
      setStats({
        totalConversations: conversations.length,
        activeConversations: conversations.filter(c => c.status === 'open').length,
        closedConversations: 0, // İleride hesaplanabilir
        avgResponseTime: '2.5 dk'
      })

      // Ollama durumu
      const ollamaRes = await ragApi.checkHealth()
      setOllamaStatus(ollamaRes.data)

    } catch (error) {
      console.error('Dashboard veri hatası:', error)
      toast.error('Veriler yüklenirken hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Ana Sayfa</h1>
          {isAdmin && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full flex items-center gap-1">
              <FiShield className="text-purple-600" />
              Admin
            </span>
          )}
        </div>
        <p className="text-gray-600 mt-2">
          AsistTR yönetim panelinize hoş geldiniz
          {!isAdmin && ' (Agent Modu)'}
        </p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={FiMessageCircle}
          title="Toplam Sohbet"
          value={stats.totalConversations}
          color="blue"
        />
        <StatCard
          icon={FiUsers}
          title="Aktif Sohbet"
          value={stats.activeConversations}
          color="green"
        />
        <StatCard
          icon={FiCheckCircle}
          title="Tamamlanan"
          value={stats.closedConversations}
          color="purple"
        />
        <StatCard
          icon={FiClock}
          title="Ort. Yanıt Süresi"
          value={stats.avgResponseTime}
          color="orange"
        />
      </div>

      {/* Yeni Özellikler - Queue Monitor & Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <QueueMonitor />
        <PerformanceMetrics 
          agentId={!isAdmin ? user?.id : null}
          siteId={isAdmin && sites[0] ? sites[0].id : null}
        />
      </div>

      {/* Siteler - Sadece Admin */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Kayıtlı Siteler</h2>
          {sites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Henüz kayıtlı site yok. Ayarlar sayfasından yeni site ekleyebilirsiniz.
            </div>
          ) : (
            <div className="space-y-4">
              {sites.map((site) => (
                <div key={site.id} className="border rounded-lg p-4 hover:border-primary-500 transition">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{site.name}</h3>
                      <p className="text-sm text-gray-600">{site.domain}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      site.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {site.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent için Yönlendirme */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">🎯 Agent Modu</h2>
          <p className="text-blue-700 mb-4">
            Sohbetler sayfasına giderek müşterilerle konuşmaya başlayabilirsiniz.
          </p>
          <a 
            href="/chat" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sohbetlere Git →
          </a>
        </div>
      )}

      {/* AI Durum - Sadece Admin */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">AI Asistan Durumu (Ollama)</h2>
          {ollamaStatus ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Durum</p>
                <p className={`font-semibold ${
                  ollamaStatus.status === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {ollamaStatus.status === 'ok' ? '✅ Çalışıyor' : '❌ Çalışmıyor'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{ollamaStatus.message}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Model</p>
                <p className="font-semibold">{ollamaStatus.model}</p>
                <p className="text-xs text-gray-500 mt-1">{ollamaStatus.url}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Yükleniyor...</p>
          )}
        </div>
      )}
    </div>
  )
}

// İstatistik kartı bileşeni
function StatCard({ icon: Icon, title, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
          <Icon className="text-2xl" />
        </div>
      </div>
    </div>
  )
}

export default DashboardPage

