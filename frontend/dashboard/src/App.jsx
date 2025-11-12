import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import KnowledgePage from './pages/KnowledgePage'
import SettingsPage from './pages/SettingsPage'
import AgentsPage from './pages/AgentsPage'
import DepartmentsPage from './pages/DepartmentsPage'
import CannedResponsesPage from './pages/CannedResponsesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import WidgetSettingsPage from './pages/WidgetSettingsPage'
import NotificationSettingsPage from './pages/NotificationSettingsPage'
import OfflineMessagesPage from './pages/OfflineMessagesPage'
import QueuePage from './pages/QueuePage'
import AgentStatePage from './pages/AgentStatePage'

// Layout
import DashboardLayout from './components/DashboardLayout'

function App() {
  const { token } = useAuthStore()

  return (
    <>
      <Toaster position="bottom-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          <Route 
            path="/*"
            element={
              token ? <DashboardLayout /> : <Navigate to="/login" />
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="canned-responses" element={<CannedResponsesPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="widget-settings" element={<WidgetSettingsPage />} />
            <Route path="notifications" element={<NotificationSettingsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="offline-messages" element={<OfflineMessagesPage />} />
            <Route path="queue" element={<QueuePage />} />
            <Route path="agent-state" element={<AgentStatePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App



