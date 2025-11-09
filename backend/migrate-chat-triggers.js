/**
 * Chat Triggers Migration
 * Proaktif sohbet tetikleyicileri için gerekli veritabanı tablolarını oluşturur
 */

const { query } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrateChatTriggers() {
  try {
    logger.info('Chat triggers migration başlatılıyor...');

    // Chat triggers tablosu - proaktif sohbet tetikleyicileri
    await query(`
      CREATE TABLE IF NOT EXISTS chat_triggers (
        id SERIAL PRIMARY KEY,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL, -- page_visit, scroll, exit_intent, inactivity, url_match
        enabled BOOLEAN DEFAULT true,
        conditions JSONB, -- {delay: 30, scroll_percentage: 80, url_pattern: '/pricing', inactivity_seconds: 60}
        message TEXT NOT NULL,
        priority INTEGER DEFAULT 0, -- Yüksek öncelikli trigger'lar önce tetiklenir
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ chat_triggers tablosu oluşturuldu');

    // Trigger statistics - tetikleyici istatistikleri
    await query(`
      CREATE TABLE IF NOT EXISTS trigger_statistics (
        id SERIAL PRIMARY KEY,
        trigger_id INTEGER REFERENCES chat_triggers(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        triggered_at TIMESTAMP DEFAULT NOW(),
        converted BOOLEAN DEFAULT false, -- Visitor mesaj gönderdi mi?
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL
      )
    `);
    logger.info('✅ trigger_statistics tablosu oluşturuldu');

    // İndeksler
    await query('CREATE INDEX IF NOT EXISTS idx_chat_triggers_site ON chat_triggers(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_chat_triggers_enabled ON chat_triggers(enabled)');
    await query('CREATE INDEX IF NOT EXISTS idx_trigger_stats_trigger ON trigger_statistics(trigger_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_trigger_stats_visitor ON trigger_statistics(visitor_id)');
    logger.info('✅ İndeksler oluşturuldu');

    // Örnek trigger'lar ekle
    await query(`
      INSERT INTO chat_triggers (site_id, name, type, conditions, message, priority)
      SELECT 
        id as site_id,
        'Hoş Geldiniz' as name,
        'page_visit' as type,
        '{"delay": 10}'::jsonb as conditions,
        'Merhaba! 👋 Size nasıl yardımcı olabiliriz?' as message,
        1 as priority
      FROM sites
      WHERE NOT EXISTS (
        SELECT 1 FROM chat_triggers WHERE name = 'Hoş Geldiniz'
      )
      LIMIT 1
    `);

    await query(`
      INSERT INTO chat_triggers (site_id, name, type, conditions, message, priority)
      SELECT 
        id as site_id,
        'Sayfa Scroll' as name,
        'scroll' as type,
        '{"scroll_percentage": 50}'::jsonb as conditions,
        'İlginizi çeken bir şey mi buldunuz? Sorularınızı yanıtlamaktan mutluluk duyarız.' as message,
        2 as priority
      FROM sites
      WHERE NOT EXISTS (
        SELECT 1 FROM chat_triggers WHERE name = 'Sayfa Scroll'
      )
      LIMIT 1
    `);

    await query(`
      INSERT INTO chat_triggers (site_id, name, type, conditions, message, priority)
      SELECT 
        id as site_id,
        'Çıkış Niyeti' as name,
        'exit_intent' as type,
        '{}'::jsonb as conditions,
        'Gitmeden önce yardım edebileceğimiz bir şey var mı?' as message,
        3 as priority
      FROM sites
      WHERE NOT EXISTS (
        SELECT 1 FROM chat_triggers WHERE name = 'Çıkış Niyeti'
      )
      LIMIT 1
    `);

    logger.info('✅ Örnek trigger\'lar eklendi');

    logger.info('🎉 Chat triggers migration tamamlandı!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration hatası:', error);
    process.exit(1);
  }
}

migrateChatTriggers();
