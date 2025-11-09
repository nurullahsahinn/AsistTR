/**
 * Voice Calls Migration
 * Sesli görüşme özelliği için gerekli veritabanı tablolarını oluşturur
 */

const { query } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrateVoiceCalls() {
  try {
    logger.info('Sesli görüşme migration başlatılıyor...');

    // Voice calls tablosu - sesli görüşme kayıtları
    await query(`
      CREATE TABLE IF NOT EXISTS voice_calls (
        id SERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'waiting', -- waiting, connecting, active, ended, failed, missed
        start_time TIMESTAMP DEFAULT NOW(),
        end_time TIMESTAMP,
        duration INTEGER DEFAULT 0, -- saniye cinsinden
        caller_type VARCHAR(20) DEFAULT 'visitor', -- visitor veya agent
        disconnect_reason VARCHAR(100), -- user_hangup, agent_hangup, timeout, error
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ voice_calls tablosu oluşturuldu');

    // Call queue tablosu - bekleyen çağrılar
    await query(`
      CREATE TABLE IF NOT EXISTS call_queue (
        id SERIAL PRIMARY KEY,
        voice_call_id INTEGER REFERENCES voice_calls(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        queue_position INTEGER,
        entered_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'queued' -- queued, assigned, expired
      )
    `);
    logger.info('✅ call_queue tablosu oluşturuldu');

    // Agent call availability - agent'ların müsaitlik durumu
    await query(`
      CREATE TABLE IF NOT EXISTS agent_call_availability (
        agent_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        available_for_calls BOOLEAN DEFAULT true,
        max_concurrent_calls INTEGER DEFAULT 1,
        current_calls INTEGER DEFAULT 0,
        total_calls_today INTEGER DEFAULT 0,
        last_call_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ agent_call_availability tablosu oluşturuldu');

    // WebRTC signaling tablosu - ICE candidates ve SDP offers/answers
    await query(`
      CREATE TABLE IF NOT EXISTS webrtc_signaling (
        id SERIAL PRIMARY KEY,
        voice_call_id INTEGER REFERENCES voice_calls(id) ON DELETE CASCADE,
        from_type VARCHAR(20), -- visitor veya agent
        from_id INTEGER,
        signal_type VARCHAR(50), -- offer, answer, ice-candidate
        signal_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ webrtc_signaling tablosu oluşturuldu');

    // Call recordings metadata (opsiyonel - gelecek için)
    await query(`
      CREATE TABLE IF NOT EXISTS call_recordings (
        id SERIAL PRIMARY KEY,
        voice_call_id INTEGER REFERENCES voice_calls(id) ON DELETE CASCADE,
        file_path TEXT,
        file_size INTEGER,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ call_recordings tablosu oluşturuldu');

    // İndeksler
    await query('CREATE INDEX IF NOT EXISTS idx_voice_calls_conversation ON voice_calls(conversation_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_call_queue_status ON call_queue(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_call_queue_site ON call_queue(site_id)');
    logger.info('✅ İndeksler oluşturuldu');

    logger.info('🎉 Sesli görüşme migration tamamlandı!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration hatası:', error);
    process.exit(1);
  }
}

migrateVoiceCalls();
