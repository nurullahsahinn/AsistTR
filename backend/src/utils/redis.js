/**
 * Redis Client Yapılandırması
 * Cache ve Pub/Sub için kullanılır
 */

const { createClient } = require('redis');
const logger = require('./logger');

let redisClient = null;
let pubClient = null;
let subClient = null;

async function connectRedis() {
  try {
    // Ana Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => logger.error('Redis Client Hatası:', err));
    redisClient.on('connect', () => logger.info('Redis bağlantısı başarılı'));

    await redisClient.connect();

    // Pub/Sub için ayrı client'lar (Socket.IO için)
    pubClient = redisClient.duplicate();
    subClient = redisClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    return { redisClient, pubClient, subClient };
  } catch (error) {
    logger.error('Redis bağlantı hatası:', error);
    throw error;
  }
}

// Cache helper fonksiyonları
async function get(key) {
  try {
    return await redisClient.get(key);
  } catch (error) {
    logger.error('Redis GET hatası:', error);
    return null;
  }
}

async function set(key, value, expirySeconds = 3600) {
  try {
    return await redisClient.setEx(key, expirySeconds, value);
  } catch (error) {
    logger.error('Redis SET hatası:', error);
    return null;
  }
}

async function del(key) {
  try {
    return await redisClient.del(key);
  } catch (error) {
    logger.error('Redis DEL hatası:', error);
    return null;
  }
}

async function exists(key) {
  try {
    return await redisClient.exists(key);
  } catch (error) {
    logger.error('Redis EXISTS hatası:', error);
    return false;
  }
}

module.exports = {
  connectRedis,
  getRedisClient: () => redisClient,
  getPubClient: () => pubClient,
  getSubClient: () => subClient,
  get,
  set,
  del,
  exists
};


