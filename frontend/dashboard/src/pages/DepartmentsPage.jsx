import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      toast.error('Departmanlar getirilemedi');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, formData);
        toast.success('Departman başarıyla güncellendi');
      } else {
        await api.post('/departments', formData);
        toast.success('Departman başarıyla oluşturuldu');
      }
      
      setShowModal(false);
      resetForm();
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'İşlem başarısız');
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      is_active: dept.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (deptId) => {
    if (!confirm('Bu departmanı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await api.delete(`/departments/${deptId}`);
      toast.success('Departman başarıyla silindi');
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Departman silinemedi');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true
    });
    setEditingDept(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Departmanlar</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Departman Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${
                dept.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {dept.is_active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              {dept.description || 'Açıklama yok'}
            </p>
            
            {/* Agent Avatars */}
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {dept.agents && dept.agents.map(agent => (
                  <img
                    key={agent.id}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white"
                    src={agent.avatar_url || `https://ui-avatars.com/api/?name=${agent.name}&background=random`}
                    alt={agent.name}
                    title={agent.name}
                  />
                ))}
                {(!dept.agents || dept.agents.length === 0) && (
                  <span className="text-sm text-gray-500">
                    Agent atanmamış
                  </span>
                )}
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleEdit(dept)}
                  className="text-sm text-blue-600 hover:text-blue-900"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(dept.id)}
                  className="text-sm text-red-600 hover:text-red-900"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
          Departman bulunamadı. Başlamak için ilk departmanınızı oluşturun.
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {editingDept ? 'Departmanı Düzenle' : 'Yeni Departman Ekle'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">İsim</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">Aktif</label>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingDept ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
