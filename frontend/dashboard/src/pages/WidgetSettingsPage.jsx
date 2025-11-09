import { useState, useEffect } from 'react'
import { FiSave, FiEye } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../services/api'

function WidgetSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [siteId, setSiteId] = useState(null)

  useEffect(() => {
    loadSiteAndSettings()
  }, [])

  const loadSiteAndSettings = async () => {
    try {
      setIsLoading(true)
      // Get first site
      const sitesRes = await api.get('/widget/sites')
      if (sitesRes.data.sites && sitesRes.data.sites.length > 0) {
        const firstSite = sitesRes.data.sites[0]
        setSiteId(firstSite.id)
        
        // Load settings for this site
        const settingsRes = await api.get(`/widget-settings?siteId=${firstSite.id}`)
        setSettings(settingsRes.data.settings)
      } else {
        toast.error('Site bulunamadı. Lütfen önce bir site oluşturun.')
        // Set default settings
        setSettings({
          primary_color: '#2563eb',
          secondary_color: '#1e40af',
          text_color: '#ffffff',
          position: 'bottom-right',
          widget_title: 'Chat with us',
          welcome_message: 'Hello! How can we help you?',
          offline_message: 'We are currently offline. Please leave a message.',
          placeholder_text: 'Type your message...',
          enable_pre_chat_form: false,
          pre_chat_name_required: false,
          pre_chat_email_required: false,
          pre_chat_phone_required: false,
          language: 'en',
          auto_show_delay: 0,
          show_agent_avatars: true,
          show_typing_indicator: true,
          sound_notifications: true,
          show_branding: true
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Widget ayarları yüklenemedi: ' + (error.response?.data?.error || error.message))
      // Set default settings on error
      setSettings({
        primary_color: '#2563eb',
        secondary_color: '#1e40af',
        text_color: '#ffffff',
        position: 'bottom-right',
        widget_title: 'Chat with us',
        welcome_message: 'Hello! How can we help you?',
        offline_message: 'We are currently offline. Please leave a message.',
        placeholder_text: 'Type your message...',
        enable_pre_chat_form: false,
        pre_chat_name_required: false,
        pre_chat_email_required: false,
        pre_chat_phone_required: false,
        language: 'en',
        auto_show_delay: 0,
        show_agent_avatars: true,
        show_typing_indicator: true,
        sound_notifications: true,
        show_branding: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!siteId) return
    
    try {
      setIsSaving(true)
      await api.put(`/widget-settings/${siteId}`, settings)
      toast.success('Widget ayarları kaydedildi!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Ayarlar kaydedilemedi')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Widget Ayarları</h1>
          <p className="text-gray-600">Customize your chat widget appearance and behavior</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.open('/test-widget.html', '_blank')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FiEye /> Preview
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <FiSave /> {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Görünüm */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Görünüm</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="h-10 w-20 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primary_color}
                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.secondary_color}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    className="h-10 w-20 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color}
                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Position
                </label>
                <select
                  value={settings.position}
                  onChange={(e) => updateSetting('position', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Messages</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={settings.widget_title}
                  onChange={(e) => updateSetting('widget_title', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={settings.welcome_message}
                  onChange={(e) => updateSetting('welcome_message', e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Offline Message
                </label>
                <textarea
                  value={settings.offline_message}
                  onChange={(e) => updateSetting('offline_message', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Placeholder
                </label>
                <input
                  type="text"
                  value={settings.placeholder_text}
                  onChange={(e) => updateSetting('placeholder_text', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Pre-chat Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Pre-chat Form</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enable_pre_chat_form}
                  onChange={(e) => updateSetting('enable_pre_chat_form', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium">Enable pre-chat form</span>
              </label>

              {settings.enable_pre_chat_form && (
                <div className="ml-6 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.pre_chat_name_required}
                      onChange={(e) => updateSetting('pre_chat_name_required', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Require name</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.pre_chat_email_required}
                      onChange={(e) => updateSetting('pre_chat_email_required', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Require email</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.pre_chat_phone_required}
                      onChange={(e) => updateSetting('pre_chat_phone_required', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm">Require phone</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Davranış */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Davranış</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auto-show delay (seconds, 0 = disabled)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.auto_show_delay}
                  onChange={(e) => updateSetting('auto_show_delay', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.show_agent_avatars}
                  onChange={(e) => updateSetting('show_agent_avatars', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Show agent avatars</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.show_typing_indicator}
                  onChange={(e) => updateSetting('show_typing_indicator', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Show typing indicator</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.sound_notifications}
                  onChange={(e) => updateSetting('sound_notifications', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Sound notifications</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.show_branding}
                  onChange={(e) => updateSetting('show_branding', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm">Show "Powered by AsistTR"</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-8">
            <h2 className="text-xl font-bold mb-4">Preview</h2>
            <div className="bg-gray-100 rounded-lg p-4 h-96 relative">
              <div
                className="absolute w-16 h-16 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, ${settings.primary_color} 0%, ${settings.secondary_color} 100%)`,
                  [settings.position.includes('bottom') ? 'bottom' : 'top']: '16px',
                  [settings.position.includes('right') ? 'right' : 'left']: '16px'
                }}
              >
                <svg width="24" height="24" fill={settings.text_color} viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p><strong>Konum:</strong> {settings.position}</p>
              <p><strong>Dil:</strong> {settings.language}</p>
              <p><strong>Title:</strong> {settings.widget_title}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WidgetSettingsPage
