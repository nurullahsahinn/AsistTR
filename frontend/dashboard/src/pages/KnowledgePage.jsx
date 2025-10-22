import { useState, useEffect } from 'react'
import { ragApi, siteApi } from '../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi'

function KnowledgePage() {
  const [knowledge, setKnowledge] = useState([])
  const [sites, setSites] = useState([])
  const [selectedSite, setSelectedSite] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    metadata: {}
  })

  useEffect(() => {
    loadSites()
  }, [])

  useEffect(() => {
    if (selectedSite) {
      loadKnowledge()
    }
  }, [selectedSite])

  const loadSites = async () => {
    try {
      const response = await siteApi.getSites()
      const siteList = response.data.sites
      setSites(siteList)
      if (siteList.length > 0) {
        setSelectedSite(siteList[0].id)
      }
    } catch (error) {
      toast.error('Siteler yüklenemedi')
    }
  }

  const loadKnowledge = async () => {
    try {
      const response = await ragApi.getKnowledge(selectedSite)
      setKnowledge(response.data.knowledge)
    } catch (error) {
      toast.error('Bilgiler yüklenemedi')
    }
  }

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item.id)
      setFormData({
        title: item.title,
        content: item.content,
        metadata: item.metadata || {}
      })
    } else {
      setEditingItem(null)
      setFormData({ title: '', content: '', metadata: {} })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({ title: '', content: '', metadata: {} })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingItem) {
        await ragApi.updateKnowledge(editingItem, formData)
        toast.success('Bilgi güncellendi')
      } else {
        await ragApi.createKnowledge({
          siteId: selectedSite,
          ...formData
        })
        toast.success('Bilgi eklendi')
      }
      
      closeModal()
      loadKnowledge()
    } catch (error) {
      toast.error('İşlem başarısız')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Bu bilgiyi silmek istediğinize emin misiniz?')) return

    try {
      await ragApi.deleteKnowledge(id)
      toast.success('Bilgi silindi')
      loadKnowledge()
    } catch (error) {
      toast.error('Silme başarısız')
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Bilgi Tabanı</h1>
          <p className="text-gray-600 mt-2">AI için öğrenme kaynaklarını yönetin</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <FiPlus />
          Yeni Bilgi Ekle
        </button>
      </div>

      {/* Site Seçici */}
      {sites.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Site Seçin</label>
          <select
            value={selectedSite || ''}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Bilgi Listesi */}
      <div className="bg-white rounded-lg shadow">
        {knowledge.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Henüz bilgi eklenmemiş. "Yeni Bilgi Ekle" butonunu kullanarak başlayın.
          </div>
        ) : (
          <div className="divide-y">
            {knowledge.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{item.title}</h3>
                    <p className="text-gray-600 mt-2 line-clamp-2">{item.content}</p>
                    <div className="flex gap-2 mt-2">
                      {item.metadata?.category && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                          {item.metadata.category}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded ${
                        item.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openModal(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingItem ? 'Bilgiyi Düzenle' : 'Yeni Bilgi Ekle'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Başlık
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İçerik
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingItem ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgePage

