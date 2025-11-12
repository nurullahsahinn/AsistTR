/**
 * Queue Management Page
 * Sohbet kuyruğu yönetimi
 */

import { useState, useEffect } from 'react';
import { queueApi } from '../services/api';
import toast from 'react-hot-toast';
import { 
  FiClock, 
  FiUsers, 
  FiAlertCircle, 
  FiStar,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';

export default function QueuePage() {
  const [queueData, setQueueData] = useState({ summary: {}, items: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load queue data
  const loadQueueData = async () => {
    try {
      setRefreshing(true);
      const res = await queueApi.getQueueStatus();
      setQueueData(res.data);
    } catch (error) {
      console.error('Kuyruk yüklenirken hata:', error);
      toast.error('Kuyruk verileri yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(loadQueueData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Remove from queue
  const handleRemoveFromQueue = async (queueId) => {
    if (!confirm('Bu kişiyi kuyruktan çıkarmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await queueApi.removeFromQueue(queueId);
      toast.success('Kuyruktan çıkarıldı');
      loadQueueData();
    } catch (error) {
      console.error('Kuyruktan çıkarma hatası:', error);
      toast.error('Kuyruktan çıkarılamadı');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { summary, items } = queueData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sohbet Kuyruğu</h1>
          <p className="text-gray-600 mt-1">Bekleyen ziyaretçileri yönetin</p>
        </div>
        <button
          onClick={loadQueueData}
          disabled={refreshing}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Bekleyen</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.waiting || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FiUsers className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ortalama Bekleme</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.averageWaitTime || 0}dk</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FiClock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Uzun Bekleme</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.longestWait || 0}dk</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <FiAlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">VIP Bekleyen</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.vipInQueue || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <FiStar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Queue Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Kuyrukta Bekleyenler</h2>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Kuyrukta kimse yok</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {items.map((item) => {
              const waitMinutes = Math.floor(
                (new Date() - new Date(item.entered_at)) / 60000
              );
              
              return (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Priority indicator */}
                      {item.priority > 0 && (
                        <FiStar className="w-5 h-5 text-purple-600 fill-purple-600" />
                      )}
                      
                      {/* Visitor info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">
                            {item.visitor_name || 'Ziyaretçi'}
                          </h3>
                          {item.priority > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                              VIP
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Bekleme süresi: {waitMinutes} dakika
                        </p>
                      </div>
                    </div>

                    {/* Wait time indicator */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          waitMinutes > 10 ? 'text-red-600' : 
                          waitMinutes > 5 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {waitMinutes}dk
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.entered_at).toLocaleTimeString('tr-TR')}
                        </p>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveFromQueue(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Kuyruktan çıkar"
                      >
                        <FiX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
