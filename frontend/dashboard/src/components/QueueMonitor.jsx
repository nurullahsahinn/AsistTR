import { useState, useEffect } from 'react'
import { FiUsers, FiClock, FiAlertCircle, FiTrendingUp } from 'react-icons/fi'
import api from '../services/api'

function QueueMonitor() {
  const [queueData, setQueueData] = useState({
    waiting: 0,
    averageWaitTime: 0,
    longestWait: 0,
    vipInQueue: 0
  })
  const [queueItems, setQueueItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueueData()
    const interval = setInterval(fetchQueueData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchQueueData = async () => {
    try {
      const response = await api.get('/queue/status')
      setQueueData(response.data.summary || {})
      setQueueItems(response.data.items || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch queue data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            📊 Queue Monitor
          </h2>
          {queueData.waiting > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
              {queueData.waiting} Waiting
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiUsers className="text-blue-600" />
              <span className="text-xs text-gray-600">In Queue</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{queueData.waiting}</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiClock className="text-yellow-600" />
              <span className="text-xs text-gray-600">Avg Wait</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {queueData.averageWaitTime}m
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiAlertCircle className="text-red-600" />
              <span className="text-xs text-gray-600">Longest</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {queueData.longestWait}m
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <FiTrendingUp className="text-purple-600" />
              <span className="text-xs text-gray-600">VIP</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {queueData.vipInQueue}
            </p>
          </div>
        </div>

        {/* Queue Items */}
        {queueItems.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Queue</h3>
            {queueItems.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  item.priority > 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">
                    #{item.queue_position}
                  </span>
                  {item.priority > 0 && (
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                      VIP
                    </span>
                  )}
                  <span className="text-sm text-gray-900">
                    {item.visitor_name || 'Visitor'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Wait: {item.estimated_wait_minutes}m</span>
                  {item.required_skills && item.required_skills.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                      {item.required_skills.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FiUsers className="mx-auto text-4xl mb-2 opacity-50" />
            <p>No visitors in queue</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default QueueMonitor

