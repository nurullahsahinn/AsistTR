/**
 * Voice Call Routes
 * Sesli görüşme API endpoint'leri
 */

const express = require('express');
const router = express.Router();
const voiceCallController = require('../controllers/voiceCall.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Çağrı başlat (visitor veya agent)
router.post('/initiate', voiceCallController.initiateCall);

// Agent çağrıyı kabul ediyor
router.post('/:voiceCallId/accept', authenticate, voiceCallController.acceptCall);

// Çağrıyı reddet
router.post('/:voiceCallId/reject', authenticate, voiceCallController.rejectCall);

// Çağrıyı sonlandır
router.post('/:voiceCallId/end', voiceCallController.endCall);

// Aktif çağrıları listele
router.get('/active', authenticate, voiceCallController.getActiveCalls);

// Agent müsaitlik durumu güncelle
router.post('/availability', authenticate, voiceCallController.updateCallAvailability);
router.put('/availability', authenticate, voiceCallController.updateCallAvailability);

// Konuşmaya ait arama geçmişini getir
router.get('/conversation/:conversationId/history', authenticate, voiceCallController.getCallHistory);

module.exports = router;
