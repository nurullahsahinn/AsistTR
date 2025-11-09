import { useState, useEffect } from 'react'
import { FiCircle } from 'react-icons/fi'
import api from '../services/api'

function AgentPresence({ agentId, showName = false, size = 'md' }) {
  const [presence, setPresence] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (agentId) {
      loadPresence()
    }
  }, [agentId])

  const loadPresence = async () => {
    try {
      const res = await api.get(`/api/presence/agents/${agentId}`)
      setPresence(res.data.presence)
    } catch (error) {
      console.error('Failed to load presence:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !presence) return null

  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    away: { color: 'bg-yellow-500', label: 'Away' },
    busy: { color: 'bg-red-500', label: 'Busy' },
    offline: { color: 'bg-gray-400', label: 'Offline' }
  }

  const config = statusConfig[presence.status] || statusConfig.offline

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`${sizeClasses[size]} ${config.color} rounded-full`}></div>
        {presence.status === 'online' && (
          <div className={`absolute inset-0 ${config.color} rounded-full animate-ping opacity-75`}></div>
        )}
      </div>
      {showName && (
        <span className="text-sm text-gray-700">
          {presence.agent_name} {presence.custom_status && `(${presence.custom_status})`}
        </span>
      )}
    </div>
  )
}

export default AgentPresence
