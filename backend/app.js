/**
 * AsistTR - Ana Backend Sunucu Dosyası
 * 
 * Bu dosya Express sunucusunu ve Socket.IO'yu başlatır.
 * Tüm route'ları ve middleware'leri yapılandırır.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const path = require('path');

// Kritik environment variable kontrolleri
if (!process.env.JWT_SECRET) {
  console.error('❌ HATA: JWT_SECRET environment variable tanımlı değil!');
  console.error('İpucu: .env dosyasında JWT_SECRET=güçlü-bir-secret-anahtar ekleyin');
  process.exit(1);
}

// Utils
const logger = require('./src/utils/logger');
const { connectDatabase } = require('./src/utils/database');
const { connectRedis } = require('./src/utils/redis');
const { xssSanitize } = require('./src/middleware/xss.middleware');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const chatRoutes = require('./src/routes/chat.routes');
const widgetRoutes = require('./src/routes/widget.routes');
const ragRoutes = require('./src/routes/rag.routes');
const agentRoutes = require('./src/routes/agent.routes');
const departmentRoutes = require('./src/routes/department.routes');
const cannedRoutes = require('./src/routes/canned.routes');
const chatEnhancementRoutes = require('./src/routes/chatEnhancement.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const widgetSettingsRoutes = require('./src/routes/widgetSettings.routes');
const notificationRoutes = require('./src/routes/notification.routes');
const presenceRoutes = require('./src/routes/presence.routes');
const voiceCallRoutes = require('./src/routes/voiceCall.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const agentStateRoutes = require('./src/routes/agentState.routes');
const offlineMessageRoutes = require('./src/routes/offlineMessage.routes');
const metricsRoutes = require('./src/routes/metrics.routes');
const queueRoutes = require('./src/routes/queue.routes');

// Socket handlers
const socketHandler = require('./src/socket/socket.handler');

// App oluştur
const app = express();
const server = http.createServer(app);

// CORS ayarları - Güvenlik için whitelist
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'http://localhost:5173'
];

// Socket.IO kur
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware'ler
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: (origin, callback) => {
    // Origin yoksa izin ver (mobile apps, Postman vb.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn(`CORS hatası: İzinli olmayan origin: ${origin}`);
      callback(new Error('CORS policy tarafından izin verilmedi'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// XSS Sanitization (selective - skip for certain routes that need HTML)
app.use((req, res, next) => {
  // Skip XSS sanitization for routes that need HTML content
  const skipRoutes = ['/api/rag', '/rag', '/api/knowledge', '/knowledge'];
  const shouldSkip = skipRoutes.some(route => req.path.startsWith(route));
  
  if (shouldSkip) {
    return next();
  }
  
  xssSanitize(req, res, next);
});

// Yüklenen dosyaları public olarak sun
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AsistTR Backend'
  });
});

// API Routes (with /api prefix)
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/canned', cannedRoutes);
app.use('/api/chat-enhancement', chatEnhancementRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/widget-settings', widgetSettingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/voice', voiceCallRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/agent-state', agentStateRoutes);
app.use('/api/offline-messages', offlineMessageRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/queue', queueRoutes);

// API Routes (without /api prefix for backward compatibility)
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/widget', widgetRoutes);
app.use('/rag', ragRoutes);
app.use('/agents', agentRoutes);
app.use('/departments', departmentRoutes);
app.use('/canned', cannedRoutes);
app.use('/chat-enhancement', chatEnhancementRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/widget-settings', widgetSettingsRoutes);
app.use('/notifications', notificationRoutes);
app.use('/presence', presenceRoutes);
app.use('/voice', voiceCallRoutes);
app.use('/upload', uploadRoutes);
app.use('/agent-state', agentStateRoutes);
app.use('/offline-messages', offlineMessageRoutes);
app.use('/metrics', metricsRoutes);
app.use('/queue', queueRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error('Hata:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Sunucu hatası',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO bağlantıları
io.on('connection', (socket) => {
  socketHandler(io, socket);
});

// io objesini global olarak sakla (controller'lardan erişim için)
global.socketIO = io;

// Sunucuyu başlat
const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Database bağlantısı
    await connectDatabase();
    logger.info('✅ PostgreSQL bağlantısı başarılı');

    // Redis bağlantısı
    await connectRedis();
    logger.info('✅ Redis bağlantısı başarılı');
    
    // Ollama health check (opsiyonel)
    try {
      const { healthCheck } = require('./src/rag/ollama.service');
      const ollamaHealthy = await healthCheck();
      if (ollamaHealthy) {
        logger.info('✅ Ollama servisi hazır');
      } else {
        logger.warn('⚠️ Ollama servisi erişilemiyor - AI yanıtlar devre dışı');
      }
    } catch (err) {
      logger.warn('⚠️ Ollama health check atlandı:', err.message);
    }

    // Sunucu dinlemeye başla
    server.listen(PORT, () => {
      logger.info(`🚀 AsistTR Backend ${PORT} portunda çalışıyor`);
      logger.info(`📡 WebSocket sunucusu aktif`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔒 JWT Secret: ${process.env.JWT_SECRET ? '✅ Tanımlı' : '❌ Eksik'}`);
      logger.info(`🌐 CORS Origins: ${allowedOrigins.join(', ')}`);
    });

  } catch (error) {
    logger.error('❌ Sunucu başlatılamadı:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM sinyali alındı. Sunucu kapatılıyor...');
  server.close(() => {
    logger.info('Sunucu kapatıldı');
    process.exit(0);
  });
});

module.exports = { app, io };



