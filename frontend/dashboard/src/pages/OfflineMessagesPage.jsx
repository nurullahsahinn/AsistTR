import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { FiInbox, FiCheckCircle, FiTrash2, FiClock } from 'react-icons/fi';

export default function OfflineMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending', 'contacted', 'resolved'

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/offline-messages?status=${filter}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      toast.error('Çevrimdışı mesajlar getirilemedi.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (messageId, status) => {
    try {
      await api.put(`/offline-messages/${messageId}/status`, { status });
      toast.success(`Mesaj durumu "${status}" olarak güncellendi.`);
      fetchMessages(); // Listeyi yenile
    } catch (error) {
      toast.error('Durum güncellenemedi.');
    }
  };

  const handleDelete = async (messageId) => {
    if (!confirm('Bu mesajı silmek istediğinizden emin misiniz?')) return;
    try {
      await api.delete(`/offline-messages/${messageId}`);
      toast.success('Mesaj başarıyla silindi.');
      fetchMessages(); // Listeyi yenile
    } catch (error) {
      toast.error('Mesaj silinemedi.');
    }
  };
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('tr-TR', options);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <FiInbox className="mr-3" /> Gelen Kutusu (Çevrimdışı Mesajlar)
        </h1>
        <div>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm"
          >
            <option value="pending">Bekleyen</option>
            <option value="contacted">İletişime Geçildi</option>
            <option value="resolved">Çözüldü</option>
            <option value="all">Tümü</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">Yükleniyor...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Filtreyle eşleşen mesaj bulunamadı.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {messages.map((msg) => (
              <li key={msg.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">{msg.name}</span>
                      <a href={`mailto:${msg.email}`} className="text-sm text-blue-600">{msg.email}</a>
                    </div>
                    <p className="mt-2 text-gray-700">{msg.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-gray-500 flex items-center">
                      <FiClock className="mr-1" />
                      {formatDate(msg.created_at)}
                    </span>
                    <div className="flex items-center gap-2">
                       {msg.status === 'pending' && (
                        <button onClick={() => handleUpdateStatus(msg.id, 'contacted')} className="text-sm text-green-600 hover:text-green-800 flex items-center" title="İletişime Geçildi Olarak İşaretle">
                          <FiCheckCircle className="mr-1" /> İletişime Geçildi
                        </button>
                      )}
                      <button onClick={() => handleDelete(msg.id)} className="text-sm text-red-600 hover:text-red-800" title="Mesajı Sil">
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

