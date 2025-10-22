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

// Socket.IO kur
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
});

// Middleware'ler
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

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

    // Sunucu dinlemeye başla
    server.listen(PORT, () => {
      logger.info(`🚀 AsistTR Backend ${PORT} portunda çalışıyor`);
      logger.info(`📡 WebSocket sunucusu aktif`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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

