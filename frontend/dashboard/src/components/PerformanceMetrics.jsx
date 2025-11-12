import { useState, useEffect } from 'react'
import { FiClock, FiCheckCircle, FiActivity, FiStar } from 'react-icons/fi'
import api from '../services/api'

function PerformanceMetrics({ agentId, siteId, period = '7d' }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [agentId, siteId, period])

  const fetchMetrics = async () => {
    try {
      let endpoint
      if (agentId) {
        endpoint = `/metrics/agent/${agentId}?period=${period}`
      } else if (siteId) {
        endpoint = `/metrics/site/${siteId}?period=${period}`
      } else {
        return
      }

      const response = await api.get(endpoint)
      setMetrics(response.data.metrics)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      setLoading(false)
    }
  }

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A'
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`
  }

  const formatRating = (score) => {
    if (!score) return 'N/A'
    return `${parseFloat(score).toFixed(1)} / 5.0`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-gray-100 rounded"></div>
            <div className="h-20 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">No metrics available</p>
      </div>
    )
  }

  const metricCards = [
    {
      label: 'First Response Time',
      value: formatTime(metrics.avg_first_response_time),
      icon: FiClock,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      iconColor: 'text-blue-500'
    },
    {
      label: 'Avg Response Time',
      value: formatTime(metrics.avg_response_time),
      icon: FiActivity,
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      iconColor: 'text-green-500'
    },
    {
      label: 'Resolution Time',
      value: formatTime(metrics.avg_resolution_time),
      icon: FiCheckCircle,
      color: 'purple',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      iconColor: 'text-purple-500'
    },
    {
      label: 'Customer Satisfaction',
      value: formatRating(metrics.avg_csat),
      icon: FiStar,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      iconColor: 'text-yellow-500'
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            📈 Performance Metrics
          </h2>
          <span className="text-sm text-gray-500">
            {metrics.total_conversations} conversations
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((metric, index) => (
            <div key={index} className={`${metric.bgColor} rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <metric.icon className={metric.iconColor} />
                <span className="text-xs text-gray-600">{metric.label}</span>
              </div>
              <p className={`text-2xl font-bold ${metric.textColor}`}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>

        {/* Additional Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {metrics.total_messages || 0}
            </p>
            <p className="text-sm text-gray-600">Total Messages</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {metrics.total_conversations || 0}
            </p>
            <p className="text-sm text-gray-600">Total Conversations</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceMetrics







