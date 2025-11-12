/**
 * Agent State Page
 * Agent durumu ve mola yönetimi
 */

import { useState, useEffect } from 'react';
import { agentStateApi } from '../services/api';
import toast from 'react-hot-toast';
import { 
  FiCoffee, 
  FiCircle,
  FiClock,
  FiUsers
} from 'react-icons/fi';

const STATES = [
  { value: 'available', label: 'Müsait', color: 'green' },
  { value: 'busy', label: 'Meşgul', color: 'yellow' },
  { value: 'break', label: 'Molada', color: 'orange' },
  { value: 'offline', label: 'Çevrimdışı', color: 'gray' },
];

const BREAK_TYPES = [
  { value: 'lunch', label: 'Öğle Yemeği' },
  { value: 'tea', label: 'Çay Molası' },
  { value: 'meeting', label: 'Toplantı' },
  { value: 'other', label: 'Diğer' },
];

export default function AgentStatePage() {
  const [myState, setMyState] = useState(null);
  const [allStates, setAllStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakType, setBreakType] = useState('tea');
  const [breakReason, setBreakReason] = useState('');

  // Load agent states
  const loadStates = async () => {
    try {
      const [myRes, allRes] = await Promise.all([
        agentStateApi.getAgentState(),
        agentStateApi.getAllAgentsStates()
      ]);
      
      setMyState(myRes.data.state);
      setAllStates(allRes.data.states || []);
    } catch (error) {
      console.error('Durum yükleme hatası:', error);
      toast.error('Durum bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(loadStates, 30000);
    return () => clearInterval(interval);
  }, []);

  // Change state
  const handleStateChange = async (newState) => {
    if (newState === 'break') {
      setShowBreakModal(true);
      return;
    }

    try {
      await agentStateApi.updateAgentState(newState);
      toast.success('Durum güncellendi');
      loadStates();
    } catch (error) {
      console.error('Durum değiştirme hatası:', error);
      toast.error('Durum güncellenemedi');
    }
  };

  // Start break
  const handleStartBreak = async () => {
    try {
      await agentStateApi.startBreak(breakType, breakReason);
      toast.success('Mola başlatıldı');
      setShowBreakModal(false);
      setBreakReason('');
      loadStates();
    } catch (error) {
      console.error('Mola başlatma hatası:', error);
      toast.error('Mola başlatılamadı');
    }
  };

  // End break
  const handleEndBreak = async () => {
    try {
      await agentStateApi.endBreak();
      toast.success('Mola sonlandırıldı');
      loadStates();
    } catch (error) {
      console.error('Mola bitirme hatası:', error);
      toast.error('Mola bitirilemedi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getStateColor = (state) => {
    const stateObj = STATES.find(s => s.value === state);
    return stateObj?.color || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Durum Yönetimi</h1>
        <p className="text-gray-600 mt-1">Çalışma durumunuzu ve molanızı yönetin</p>
      </div>

      {/* My State */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Benim Durumum</h2>
        
        {myState?.on_break ? (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <FiCoffee className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-900">Molada</span>
              </div>
              {myState.break_type && (
                <p className="text-sm text-orange-700">
                  Mola Tipi: {BREAK_TYPES.find(bt => bt.value === myState.break_type)?.label}
                </p>
              )}
              {myState.break_started_at && (
                <p className="text-sm text-orange-600 mt-1">
                  Başlangıç: {new Date(myState.break_started_at).toLocaleTimeString('tr-TR')}
                </p>
              )}
            </div>
            
            <button
              onClick={handleEndBreak}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Molayı Bitir
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATES.map((state) => {
              const isActive = myState?.status === state.value;
              const colorClasses = {
                green: 'bg-green-100 text-green-700 border-green-300',
                yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                orange: 'bg-orange-100 text-orange-700 border-orange-300',
                gray: 'bg-gray-100 text-gray-700 border-gray-300',
              };
              
              return (
                <button
                  key={state.value}
                  onClick={() => handleStateChange(state.value)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    isActive 
                      ? colorClasses[state.color] + ' font-semibold'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FiCircle className={`w-3 h-3 ${isActive ? 'fill-current' : ''}`} />
                    <span>{state.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* All Agents States */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tüm Agentler</h2>
        </div>

        {allStates.length === 0 ? (
          <div className="text-center py-12">
            <FiUsers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Agent bulunamadı</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {allStates.map((agent) => {
              const color = getStateColor(agent.status);
              const stateLabel = STATES.find(s => s.value === agent.status)?.label || agent.status;
              
              return (
                <div key={agent.agent_id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full bg-${color}-500`}></div>
                      <div>
                        <h3 className="font-medium text-gray-900">{agent.agent_name}</h3>
                        <p className="text-sm text-gray-600">{stateLabel}</p>
                      </div>
                    </div>
                    
                    {agent.on_break && (
                      <div className="flex items-center gap-2 text-orange-600">
                        <FiCoffee className="w-4 h-4" />
                        <span className="text-sm">Molada</span>
                        {agent.break_started_at && (
                          <span className="text-xs text-gray-500">
                            ({Math.floor((new Date() - new Date(agent.break_started_at)) / 60000)}dk)
                          </span>
                        )}
                      </div>
                    )}
                    
                    {agent.last_activity_at && !agent.on_break && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <FiClock className="w-4 h-4" />
                        <span className="text-sm">
                          {new Date(agent.last_activity_at).toLocaleTimeString('tr-TR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Break Modal */}
      {showBreakModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mola Başlat</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mola Tipi
                </label>
                <select
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {BREAK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama (Opsiyonel)
                </label>
                <textarea
                  value={breakReason}
                  onChange={(e) => setBreakReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Mola sebebi..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBreakModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleStartBreak}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Molayı Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
