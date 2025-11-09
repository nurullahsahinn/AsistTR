import { useState, useEffect } from 'react'
import { FiUsers, FiEye, FiMessageCircle, FiClock, FiMonitor, FiSmartphone, FiTablet, FiGlobe } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../services/api'

function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')
  const [analytics, setAnalytics] = useState(null)
  const [onlineVisitors, setOnlineVisitors] = useState([])
  const [topPages, setTopPages] = useState([])
  const [trafficSources, setTrafficSources] = useState([])
  const [deviceStats, setDeviceStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      
      // Get first site to use as siteId (optional for analytics)
      let siteId = null
      try {
        const sitesRes = await api.get('/widget/sites')
        if (sitesRes.data.sites && sitesRes.data.sites.length > 0) {
          siteId = sitesRes.data.sites[0].id
        }
      } catch (err) {
        console.log('No sites found, loading analytics without site filter')
      }
      
      const params = siteId ? `?period=${period}&siteId=${siteId}` : `?period=${period}`
      const onlineParams = siteId ? `?siteId=${siteId}` : ''
      
      const [analyticsRes, onlineRes, pagesRes, sourcesRes, devicesRes] = await Promise.all([
        api.get(`/analytics/dashboard${params}`),
        siteId ? api.get(`/analytics/online-visitors${onlineParams}`) : Promise.resolve({ data: { visitors: [] } }),
        api.get(`/analytics/top-pages?period=${period}&limit=10${siteId ? '&siteId=' + siteId : ''}`),
        api.get(`/analytics/traffic-sources?period=${period}${siteId ? '&siteId=' + siteId : ''}`),
        api.get(`/analytics/device-stats?period=${period}${siteId ? '&siteId=' + siteId : ''}`)
      ])
      
      setAnalytics(analyticsRes.data)
      setOnlineVisitors(onlineRes.data.visitors || [])
      setTopPages(pagesRes.data.pages || [])
      setTrafficSources(sourcesRes.data.sources || [])
      setDeviceStats(devicesRes.data)
      
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast.error('Analitik verileri yüklenemedi: ' + (error.response?.data?.error || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Analitik</h1>
          <p className="text-gray-600">Ziyaretçi takibi ve performans metrikleri</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-2">
          {['24h', '7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === '24h' ? 'Son 24 Saat' : p === '7d' ? 'Son 7 Gün' : p === '30d' ? 'Son 30 Gün' : 'Son 90 Gün'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={FiUsers}
          title="Toplam Ziyaretçi"
          value={analytics.totalVisitors}
          subtitle={`${analytics.newVisitors} yeni, ${analytics.returningVisitors} geri dönen`}
          color="blue"
        />
        <StatCard
          icon={FiEye}
          title="Sayfa Görüntüleme"
          value={analytics.totalPageViews}
          subtitle={`${analytics.totalSessions} oturum`}
          color="green"
        />
        <StatCard
          icon={FiMessageCircle}
          title="Konuşmalar"
          value={analytics.totalConversations}
          subtitle={`${analytics.onlineVisitorsCount} aktif ziyaretçi`}
          color="purple"
        />
        <StatCard
          icon={FiClock}
          title="Ort. Oturum"
          value={formatDuration(analytics.avgSessionDuration)}
          subtitle={`${analytics.bounceRate.toFixed(1)}% hemen çıkma`}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Online Visitors */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Aktif Ziyaretçiler ({onlineVisitors.length})</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {onlineVisitors.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aktif ziyaretçi yok</p>
            ) : (
              onlineVisitors.map(visitor => (
                <div key={visitor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                  <div className="flex-1">
                    <p className="font-medium">{visitor.name || 'Anonim'}</p>
                    <p className="text-sm text-gray-600">{visitor.current_page || 'Bilinmeyen sayfa'}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                      <span>{visitor.browser}</span>
                      <span>•</span>
                      <span>{visitor.device_type}</span>
                      <span>•</span>
                      <span>{visitor.page_views} sayfa</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Popüler Sayfalar</h2>
          <div className="space-y-2">
            {topPages.map((page, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{page.page_title || page.page_url}</p>
                  <p className="text-xs text-gray-500 truncate">{page.page_url}</p>
                </div>
                <div className="ml-3 text-right">
                  <p className="font-semibold text-blue-600">{page.views}</p>
                  <p className="text-xs text-gray-500">{page.unique_visitors} tekil</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Sources */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Trafik Kaynakları</h2>
          <div className="space-y-3">
            {trafficSources.map((source, index) => {
              const total = trafficSources.reduce((sum, s) => sum + parseInt(s.sessions), 0)
              const percentage = ((parseInt(source.sessions) / total) * 100).toFixed(1)
              
              return (
                <div key={index}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{source.source}</span>
                    <span className="text-sm text-gray-600">{source.sessions} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Device Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Cihazlar</h2>
          <div className="space-y-4">
            {deviceStats?.devices.map((device, index) => {
              const Icon = device.device_type === 'Mobile' ? FiSmartphone : device.device_type === 'Tablet' ? FiTablet : FiMonitor
              return (
                <div key={index} className="flex items-center gap-3">
                  <Icon className="text-2xl text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium">{device.device_type || 'Bilinmeyen'}</p>
                  </div>
                  <p className="font-semibold">{device.count}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Browsers */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Tarayıcılar</h2>
          <div className="space-y-4">
            {deviceStats?.browsers.map((browser, index) => (
              <div key={index} className="flex items-center gap-3">
                <FiGlobe className="text-2xl text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">{browser.browser || 'Bilinmeyen'}</p>
                </div>
                <p className="font-semibold">{browser.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, title, value, subtitle, color }) {
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
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
          <Icon className="text-2xl" />
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
