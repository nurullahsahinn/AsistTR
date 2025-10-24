/**
 * Database Migration Script
 * Tüm tabloları oluşturur
 */

const { query } = require('./database');
const logger = require('./logger');

async function migrate() {
  try {
    logger.info('Migration başlıyor...');

    // Users tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'agent',
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Users tablosu oluşturuldu');

    // Sites tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        settings JSONB DEFAULT '{}',
        api_key VARCHAR(255) UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Sites tablosu oluşturuldu');

    // Visitors tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS visitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        session_id VARCHAR(255),
        name VARCHAR(255),
        email VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Visitors tablosu oluşturuldu');

    // Conversations tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'open',
        rating INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP
      )
    `);
    logger.info('✅ Conversations tablosu oluşturuldu');

    // Messages tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_type VARCHAR(50) NOT NULL,
        sender_id UUID,
        body TEXT NOT NULL,
        attachments JSONB,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Messages tablosu oluşturuldu');

    // Knowledge Base tablosu (RAG için)
    await query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Knowledge Base tablosu oluşturuldu');

    // Agents Presence tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS agents_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        socket_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Agents Presence tablosu oluşturuldu');

    // İndeksler
    await query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_knowledge_site ON knowledge_base(site_id)');
    logger.info('✅ İndeksler oluşturuldu');

    logger.info('🎉 Migration başarıyla tamamlandı!');
  } catch (error) {
    logger.error('❌ Migration hatası:', error);
    throw error;
  }
}

// Eğer dosya doğrudan çalıştırılırsa
if (require.main === module) {
  require('dotenv').config();
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migrate;

