import { useState, useEffect } from 'react'
import { FiBell, FiMail, FiMonitor, FiVolume2, FiSave } from 'react-icons/fi'
import toast from 'react-hot-toast'
import api from '../services/api'

function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    loadPreferences()
    checkPushPermission()
  }, [])

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      const res = await api.get('/notifications/preferences')
      setPreferences(res.data.preferences)
    } catch (error) {
      console.error('Failed to load preferences:', error)
      toast.error('Bildirim tercihleri yüklenemedi: ' + (error.response?.data?.error || error.message))
      // Set default preferences on error
      setPreferences({
        email_new_conversation: true,
        email_new_message: true,
        email_conversation_assigned: true,
        email_daily_summary: false,
        browser_new_conversation: true,
        browser_new_message: true,
        browser_conversation_assigned: true,
        desktop_enabled: true,
        sound_enabled: true,
        sound_volume: 50
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkPushPermission = () => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await api.put('/notifications/preferences', preferences)
      toast.success('Bildirim tercihleri kaydedildi!')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Tercihler kaydedilemedi')
    } finally {
      setIsSaving(false)
    }
  }

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const enablePushNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Push bildirimleri tarayıcınızda desteklenmiyor')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        setPushEnabled(true)
        toast.success('Push bildirimleri etkinleştirildi!')
        
        // Here you would typically subscribe to push service
        // const registration = await navigator.serviceWorker.ready
        // const subscription = await registration.pushManager.subscribe(...)
        // await api.post('/notifications/push/subscribe', subscription)
        
      } else {
        toast.error('Push bildirim izni reddedildi')
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error)
      toast.error('Push bildirimleri etkinleştirilemedi')
    }
  }

  if (isLoading || !preferences) {
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
          <h1 className="text-2xl font-bold text-gray-800">Bildirim Ayarları</h1>
          <p className="text-gray-600">Bildirimleri nasıl alacağınızı yönetin</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          <FiSave /> {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Email Notifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <FiMail className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold">E-posta Bildirimleri</h2>
              <p className="text-sm text-gray-600">E-posta ile bildirim al</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Yeni Konuşma</p>
                <p className="text-sm text-gray-600">Yeni bir sohbet başlatıldığında</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_new_conversation}
                onChange={(e) => updatePreference('email_new_conversation', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Yeni Mesaj</p>
                <p className="text-sm text-gray-600">Yeni bir mesaj aldığınızda</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_new_message}
                onChange={(e) => updatePreference('email_new_message', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Sohbet Atandı</p>
                <p className="text-sm text-gray-600">Size bir sohbet atandığında</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_conversation_assigned}
                onChange={(e) => updatePreference('email_conversation_assigned', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Günlük Özet</p>
                <p className="text-sm text-gray-600">Konuşmalarınızın günlük özeti</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_daily_summary}
                onChange={(e) => updatePreference('email_daily_summary', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>
          </div>
        </div>

        {/* Browser Notifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <FiBell className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Tarayıcı Bildirimleri</h2>
              <p className="text-sm text-gray-600">Tarayıcınızda push bildirimleri</p>
            </div>
          </div>

          {!pushEnabled && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 mb-2">
                Push bildirimleri devre dışı. Anlık uyarılar almak için etkinleştirin.
              </p>
              <button
                onClick={enablePushNotifications}
                className="text-sm px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                Push Bildirimleri Etkinleştir
              </button>
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Yeni Konuşma</p>
                <p className="text-sm text-gray-600">Yeni bir sohbet başlatıldığında</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.browser_new_conversation}
                onChange={(e) => updatePreference('browser_new_conversation', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Yeni Mesaj</p>
                <p className="text-sm text-gray-600">Yeni bir mesaj aldığınızda</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.browser_new_message}
                onChange={(e) => updatePreference('browser_new_message', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Sohbet Atandı</p>
                <p className="text-sm text-gray-600">Size bir sohbet atandığında</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.browser_conversation_assigned}
                onChange={(e) => updatePreference('browser_conversation_assigned', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>
          </div>
        </div>

        {/* Desktop Notifications */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
              <FiMonitor className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Masaüstü Bildirimleri</h2>
              <p className="text-sm text-gray-600">Dashboard kullanırken uygulama içi bildirimler</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Masaüstü Bildirimlerini Etkinleştir</p>
                <p className="text-sm text-gray-600">Dashboard'da bildirimleri göster</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.desktop_enabled}
                onChange={(e) => updatePreference('desktop_enabled', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>
          </div>
        </div>

        {/* Sound Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
              <FiVolume2 className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Ses Ayarları</h2>
              <p className="text-sm text-gray-600">Bildirim sesleri</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <p className="font-medium">Sesleri Etkinleştir</p>
                <p className="text-sm text-gray-600">Bildirimler için ses çal</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.sound_enabled}
                onChange={(e) => updatePreference('sound_enabled', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
            </label>

            {preferences.sound_enabled && (
              <div className="p-3">
                <label className="block mb-2">
                  <p className="font-medium mb-2">Ses Seviyesi</p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={preferences.sound_volume}
                    onChange={(e) => updatePreference('sound_volume', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>0%</span>
                    <span>{preferences.sound_volume}%</span>
                    <span>100%</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationSettingsPage
