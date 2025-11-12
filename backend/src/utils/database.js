/**
 * PostgreSQL Database Bağlantısı ve Yönetimi
 */

const { Pool } = require('pg');
const logger = require('./logger');

// Connection pool oluştur (optimize edilmiş)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum pool size
  min: parseInt(process.env.DB_POOL_MIN) || 5,  // Minimum pool size
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000, // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 2000, // 2 seconds
  allowExitOnIdle: false // Keep pool alive
});

// Database bağlantısını test et
async function connectDatabase() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info('Database bağlantısı başarılı:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    logger.error('Database bağlantı hatası:', error);
    throw error;
  }
}

// Query helper
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query çalıştırıldı', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query hatası:', { text, error: error.message });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  transaction,
  connectDatabase
};




