import { useState } from 'react'
import { FiCircle, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../services/api'

function AgentStatusSelector({ currentStatus = 'online', onStatusChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customStatus, setCustomStatus] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const statuses = [
    { value: 'available', label: '✅ Available', color: 'bg-green-500', icon: '✅' },
    { value: 'away', label: '🌙 Away', color: 'bg-yellow-500', icon: '🌙' },
    { value: 'busy', label: '🔴 Busy', color: 'bg-red-500', icon: '🔴' },
    { value: 'break', label: '☕ Break', color: 'bg-orange-500', icon: '☕' },
    { value: 'dnd', label: '🚫 Do Not Disturb', color: 'bg-purple-500', icon: '🚫' },
    { value: 'offline', label: '⭕ Offline', color: 'bg-gray-400', icon: '⭕' }
  ]

  const handleStatusChange = async (status) => {
    try {
      // Use new agent-state API
      await api.put('/agent-state/state', { 
        state: status, 
        stateMessage: customStatus || null 
      })
      toast.success('✅ Durum güncellendi!')
      setIsOpen(false)
      setShowCustomInput(false)
      
      if (onStatusChange) {
        onStatusChange(status, customStatus)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('❌ Durum güncellenemedi')
    }
  }

  const currentStatusConfig = statuses.find(s => s.value === currentStatus) || statuses[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="relative">
          <div className={`w-3 h-3 ${currentStatusConfig.color} rounded-full`}></div>
          {currentStatus === 'online' && (
            <div className={`absolute inset-0 ${currentStatusConfig.color} rounded-full animate-ping opacity-75`}></div>
          )}
        </div>
        <span className="text-sm font-medium">{currentStatusConfig.label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg border z-20 min-w-[200px]">
            {statuses.map(status => (
              <button
                key={status.value}
                onClick={() => handleStatusChange(status.value)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${status.color} rounded-full`}></div>
                  <span className="text-sm">{status.label}</span>
                </div>
                {currentStatus === status.value && (
                  <FiCheck className="text-blue-600" />
                )}
              </button>
            ))}
            
            <div className="border-t p-2">
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full text-left px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Set custom status...
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="Custom status"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    autoFocus
                  />
                  <button
                    onClick={() => handleStatusChange(currentStatus)}
                    className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AgentStatusSelector
