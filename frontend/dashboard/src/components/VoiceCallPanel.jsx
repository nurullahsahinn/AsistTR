import { useState, useEffect, useRef } from 'react'
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiVolume2, FiVolumeX } from 'react-icons/fi'
import toast from 'react-hot-toast'

function VoiceCallPanel({ 
  incomingCall, 
  onAccept, 
  onReject, 
  onEnd,
  callStatus = 'idle',
  duration = 0 
}) {
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOff, setIsSpeakerOff] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    // Play ringing sound for incoming calls
    if (incomingCall && audioRef.current) {
      audioRef.current.loop = true
      audioRef.current.play().catch(e => console.error('Ring sound error:', e))
    } else if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [incomingCall])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    onAccept()
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
    // TODO: Implement actual mute functionality
    toast.info(isMuted ? '🎤 Mikrofon açık' : '🔇 Mikrofon kapalı')
  }

  const handleSpeakerToggle = () => {
    setIsSpeakerOff(!isSpeakerOff)
    toast.info(isSpeakerOff ? '🔊 Hoparlör açık' : '🔇 Hoparlör kapalı')
  }

  // Incoming call notification
  if (incomingCall) {
    return (
      <div className="fixed bottom-24 right-6 bg-white rounded-2xl shadow-2xl border-2 border-green-500 p-6 w-80 z-50 animate-bounce">
        <audio ref={audioRef} src="/ring.mp3" />
        
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse">
            <FiPhone className="text-3xl text-green-600" />
          </div>
          <h3 className="font-bold text-lg text-gray-900">Gelen Arama</h3>
          <p className="text-gray-600 mt-1">
            {incomingCall.visitorName || 'Ziyaretçi'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {incomingCall.conversationId?.substring(0, 8)}...
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            <FiPhoneOff />
            Reddet
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition animate-pulse"
          >
            <FiPhone />
            Cevapla
          </button>
        </div>
      </div>
    )
  }

  // Active call panel
  if (callStatus !== 'idle' && callStatus !== 'ended') {
    const statusText = {
      'connecting': 'Bağlanıyor...',
      'connected': 'Aramada',
      'ringing': 'Çalıyor...'
    }

    const statusColor = {
      'connecting': 'bg-yellow-100 text-yellow-800',
      'connected': 'bg-green-100 text-green-800',
      'ringing': 'bg-blue-100 text-blue-800'
    }

    return (
      <div className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-6 w-80 z-50 text-white">
        <div className="text-center mb-4">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${statusColor[callStatus] || 'bg-gray-100 text-gray-800'}`}>
            {statusText[callStatus] || callStatus}
          </div>
          <h3 className="font-bold text-lg">Sesli Arama</h3>
          {callStatus === 'connected' && (
            <p className="text-white/80 text-2xl font-mono mt-2">
              {formatDuration(duration)}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={handleMuteToggle}
            className={`p-3 rounded-full transition ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
            title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
          >
            {isMuted ? <FiMicOff className="text-xl" /> : <FiMic className="text-xl" />}
          </button>

          <button
            onClick={handleSpeakerToggle}
            className={`p-3 rounded-full transition ${
              isSpeakerOff 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
            title={isSpeakerOff ? 'Hoparlörü Aç' : 'Hoparlörü Kapat'}
          >
            {isSpeakerOff ? <FiVolumeX className="text-xl" /> : <FiVolume2 className="text-xl" />}
          </button>
        </div>

        {/* End call button */}
        <button
          onClick={onEnd}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
        >
          <FiPhoneOff />
          Aramayı Sonlandır
        </button>
      </div>
    )
  }

  return null
}

export default VoiceCallPanel

