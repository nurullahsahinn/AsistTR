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

// Routes
const authRoutes = require('./src/routes/auth.routes');
const chatRoutes = require('./src/routes/chat.routes');
const widgetRoutes = require('./src/routes/widget.routes');
const ragRoutes = require('./src/routes/rag.routes');

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/rag', ragRoutes);

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



