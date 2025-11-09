/**
 * Dashboard Layout
 * Ana dashboard layout bileşeni
 */

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { FiMessageSquare, FiBook, FiSettings, FiLogOut, FiHome, FiUsers, FiBriefcase, FiFileText, FiBarChart2, FiLayout, FiBell } from 'react-icons/fi'
import AgentStatusSelector from './AgentStatusSelector'
import socketService from '../services/socket'
import { voiceApi } from '../services/api'

function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Initialize socket connection when layout mounts
  useEffect(() => {
    if (user && user.id) {
      // ✅ Eğer zaten bağlıysa tekrar bağlanma
      if (socketService.socket?.connected) {
        console.log('✅ Socket zaten bağlı, yeni connection açılmıyor')
        return
      }
      
      console.log('Initializing socket connection for agent:', user.id)
      socketService.connect(user.id, user.site_id)
      
      // Set agent as available for voice calls
      voiceApi.updateCallAvailability(true, 1)
        .then(() => console.log('✅ Agent marked as available for calls'))
        .catch(err => console.error('❌ Failed to set call availability:', err))
    }

    return () => {
      // Don't disconnect on unmount to maintain connection across pages
      // socketService.disconnect()
    }
  }, [user])

  const handleLogout = () => {
    socketService.disconnect()
    logout()
    navigate('/login')
  }

  let menuItems = [
    { path: '/', icon: FiHome, label: 'Ana Sayfa' },
    { path: '/chat', icon: FiMessageSquare, label: 'Sohbetler' },
    { path: '/canned-responses', icon: FiFileText, label: 'Hazır Yanıtlar' },
    { path: '/analytics', icon: FiBarChart2, label: 'Analitik' },
    { path: '/notifications', icon: FiBell, label: 'Bildirimler' },
  ];

  if (user?.role === 'admin') {
    menuItems.push(
      { path: '/agents', icon: FiUsers, label: 'Agent Yönetimi' },
      { path: '/departments', icon: FiBriefcase, label: 'Departmanlar' },
      { path: '/widget-settings', icon: FiLayout, label: 'Widget Ayarları' },
      { path: '/knowledge', icon: FiBook, label: 'Bilgi Tabanı' },
      { path: '/settings', icon: FiSettings, label: 'Ayarlar' }
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary-600">AsistTR</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
        </div>

        <nav className="mt-6">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-600 border-r-4 border-primary-600' : ''
                }`}
              >
                <Icon className="text-xl" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          {/* Agent Status */}
          <div className="mb-3">
            <AgentStatusSelector />
          </div>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <FiLogOut />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default DashboardLayout



