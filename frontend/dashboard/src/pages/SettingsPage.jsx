import { useState, useEffect } from 'react'
import { siteApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiCopy, FiAlertCircle } from 'react-icons/fi'

function SettingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [sites, setSites] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [newSite, setNewSite] = useState({ name: '', domain: '' })

  useEffect(() => {
    loadSites()
  }, [])

  const loadSites = async () => {
    try {
      const response = await siteApi.getSites()
      setSites(response.data.sites)
    } catch (error) {
      toast.error('Siteler yüklenemedi')
    }
  }

  const handleCreateSite = async (e) => {
    e.preventDefault()
    
    try {
      await siteApi.createSite(newSite)
      toast.success('Site oluşturuldu!')
      setNewSite({ name: '', domain: '' })
      setIsCreating(false)
      loadSites()
    } catch (error) {
      toast.error('Site oluşturulamadı')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Kopyalandı!')
  }

  const generateWidgetCode = (apiKey) => {
    return `<script>
(function(){
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'http://localhost:5173/widget.js';
  s.setAttribute('data-api-key', '${apiKey}');
  var x = document.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s, x);
})();
</script>`
  }

  // Admin kontrolü
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
            <FiAlertCircle className="text-6xl text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Yetkisiz Erişim</h2>
            <p className="text-gray-600 mb-6">
              Site yönetimi sadece admin kullanıcılar için erişilebilir.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Ayarlar</h1>
        <p className="text-gray-600 mt-2">Site ve widget ayarlarınızı yönetin</p>
      </div>

      {/* Yeni Site Ekle */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Siteler</h2>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {isCreating ? 'İptal' : 'Yeni Site Ekle'}
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreateSite} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Adı
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Örnek: E-Ticaret Sitem"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={newSite.domain}
                  onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="ornek.com"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700"
            >
              Oluştur
            </button>
          </form>
        )}

        {/* Site Listesi */}
        {sites.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Henüz site eklenmemiş
          </div>
        ) : (
          <div className="space-y-4">
            {sites.map((site) => (
              <div key={site.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{site.name}</h3>
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

                {/* API Key */}
                <div className="mb-3">
                  <label className="block text-xs text-gray-600 mb-1">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={site.api_key}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded bg-gray-50 text-sm font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(site.api_key)}
                      className="px-3 py-2 border rounded hover:bg-gray-50"
                    >
                      <FiCopy />
                    </button>
                  </div>
                </div>

                {/* Widget Kodu */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Widget Kodu (Sitenize ekleyin)</label>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                      {generateWidgetCode(site.api_key)}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(generateWidgetCode(site.api_key))}
                      className="absolute top-2 right-2 px-2 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
                    >
                      <FiCopy className="inline mr-1" />
                      Kopyala
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage

