import { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiFilter } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../services/api'

function CannedResponsesPage() {
  const [responses, setResponses] = useState([])
  const [filteredResponses, setFilteredResponses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [editingResponse, setEditingResponse] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    shortcut: '',
    category: 'common'
  })

  const categories = [
    { value: 'greeting', label: 'Greeting' },
    { value: 'common', label: 'Common' },
    { value: 'closing', label: 'Closing' },
    { value: 'info', label: 'Information' },
    { value: 'support', label: 'Support' },
    { value: 'sales', label: 'Sales' }
  ]

  useEffect(() => {
    loadResponses()
  }, [])

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredResponses(responses)
    } else {
      setFilteredResponses(responses.filter(r => r.category === selectedCategory))
    }
  }, [selectedCategory, responses])

  const loadResponses = async () => {
    try {
      const { data } = await api.get('/canned')
      setResponses(data.cannedResponses || [])
    } catch (error) {
      console.error('Failed to load responses:', error)
      toast.error('Failed to load canned responses')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (editingResponse) {
        await api.put(`/canned/${editingResponse.id}`, formData)
        toast.success('Response updated successfully')
      } else {
        await api.post('/canned', formData)
        toast.success('Response created successfully')
      }
      
      setShowModal(false)
      setEditingResponse(null)
      setFormData({ title: '', content: '', shortcut: '', category: 'common' })
      loadResponses()
    } catch (error) {
      console.error('Failed to save response:', error)
      toast.error(error.response?.data?.error || 'Failed to save response')
    }
  }

  const handleEdit = (response) => {
    setEditingResponse(response)
    setFormData({
      title: response.title,
      content: response.content,
      shortcut: response.shortcut || '',
      category: response.category
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this response?')) return
    
    try {
      await api.delete(`/canned/${id}`)
      toast.success('Response deleted successfully')
      loadResponses()
    } catch (error) {
      console.error('Failed to delete response:', error)
      toast.error('Failed to delete response')
    }
  }

  const copyShortcut = (shortcut) => {
    navigator.clipboard.writeText(shortcut)
    toast.success('Shortcut copied to clipboard')
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Canned Responses</h1>
          <p className="text-gray-600">Pre-defined message templates for quick replies</p>
        </div>
        <button
          onClick={() => {
            setEditingResponse(null)
            setFormData({ title: '', content: '', shortcut: '', category: 'common' })
            setShowModal(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <FiPlus /> New Response
        </button>
      </div>

      {/* Category Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <FiFilter className="text-gray-500" />
          <span className="text-sm text-gray-600">Filter:</span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({responses.length})
          </button>
          {categories.map(cat => {
            const count = responses.filter(r => r.category === cat.value).length
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Responses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResponses.map(response => (
          <div key={response.id} className="bg-white rounded-lg shadow p-5 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-800">{response.title}</h3>
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded mt-1">
                  {categories.find(c => c.value === response.category)?.label || response.category}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(response)}
                  className="text-blue-600 hover:text-blue-700 p-2"
                >
                  <FiEdit2 />
                </button>
                <button
                  onClick={() => handleDelete(response.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
            
            <p className="text-gray-700 text-sm mb-3 line-clamp-3">{response.content}</p>
            
            {response.shortcut && (
              <div className="flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-700">
                  {response.shortcut}
                </code>
                <button
                  onClick={() => copyShortcut(response.shortcut)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FiCopy size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredResponses.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No canned responses found
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              {editingResponse ? 'Edit Response' : 'New Response'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 h-32"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shortcut (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.shortcut}
                      onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                      placeholder="/hello"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Type this to insert response</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingResponse(null)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingResponse ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CannedResponsesPage
