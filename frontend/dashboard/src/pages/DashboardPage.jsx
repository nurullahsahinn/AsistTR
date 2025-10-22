import { useState, useEffect } from 'react'
import { siteApi, chatApi, ragApi } from '../services/api'
import { FiMessageCircle, FiUsers, FiCheckCircle, FiClock } from 'react-icons/fi'
import toast from 'react-hot-toast'

function DashboardPage() {
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
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-2">AsistTR yönetim panelinize hoş geldiniz</p>
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

      {/* Siteler */}
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

      {/* AI Durum */}
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

