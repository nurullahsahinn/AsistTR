/**
 * Database Migration Script
 * Tüm tabloları oluşturur
 */

const { query } = require('./database');
const logger = require('./logger');

async function migrate() {
  try {
    logger.info('Migration başlıyor...');

    // PostgreSQL extensions
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    logger.info('✅ pgcrypto extension oluşturuldu');
    
    await query('CREATE EXTENSION IF NOT EXISTS vector');
    logger.info('✅ pgvector extension oluşturuldu');
    
    await query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    logger.info('✅ pg_trgm extension oluşturuldu');

    // Users tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'agent',
        site_id UUID,
        department_id UUID,
        avatar_url TEXT,
        max_chats INTEGER DEFAULT 5,
        current_chats INTEGER DEFAULT 0,
        skills TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Users tablosu oluşturuldu');

    // Users tablosuna eksik kolonları ekle (eski tablolar için)
    try {
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department_id') THEN
            ALTER TABLE users ADD COLUMN department_id UUID;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_chats') THEN
            ALTER TABLE users ADD COLUMN max_chats INTEGER DEFAULT 5;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='current_chats') THEN
            ALTER TABLE users ADD COLUMN current_chats INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='skills') THEN
            ALTER TABLE users ADD COLUMN skills TEXT[];
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='languages') THEN
            ALTER TABLE users ADD COLUMN languages TEXT[] DEFAULT ARRAY['tr'];
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='priority_level') THEN
            ALTER TABLE users ADD COLUMN priority_level INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);
      logger.info('✅ Users eksik kolonları eklendi (Languages & Priority)');
    } catch (err) {
      logger.warn('Users kolon ekleme atlandı:', err.message);
    }

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
        device_type VARCHAR(50),
        meta JSONB DEFAULT '{}',
        first_seen TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Visitors tablosu oluşturuldu');

    // Visitors tablosuna eksik kolonları ekle
    try {
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='first_seen') THEN
            ALTER TABLE visitors ADD COLUMN first_seen TIMESTAMP DEFAULT NOW();
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='last_seen') THEN
            ALTER TABLE visitors ADD COLUMN last_seen TIMESTAMP DEFAULT NOW();
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='device_type') THEN
            ALTER TABLE visitors ADD COLUMN device_type VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='browser') THEN
            ALTER TABLE visitors ADD COLUMN browser VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='os') THEN
            ALTER TABLE visitors ADD COLUMN os VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='is_online') THEN
            ALTER TABLE visitors ADD COLUMN is_online BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='is_vip') THEN
            ALTER TABLE visitors ADD COLUMN is_vip BOOLEAN DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='language') THEN
            ALTER TABLE visitors ADD COLUMN language VARCHAR(10) DEFAULT 'tr';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='vip_level') THEN
            ALTER TABLE visitors ADD COLUMN vip_level INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);
      logger.info('✅ Visitors eksik kolonları eklendi (VIP & Language support)');
    } catch (err) {
      logger.warn('Visitors kolon ekleme atlandı:', err.message);
    }

    // Conversations tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'open',
        rating INTEGER,
        feedback TEXT, -- Eklendi
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
        embedding vector(768),
        metadata JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Knowledge Base tablosu oluşturuldu');

    // Eğer embedding sütunu yoksa ekle (eski tablolar için)
    try {
      const colCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='knowledge_base' AND column_name='embedding'
      `);
      if (colCheck.rows.length === 0) {
        await query('ALTER TABLE knowledge_base ADD COLUMN embedding vector(768)');
        logger.info('✅ embedding sütunu eklendi');
      }
    } catch (err) {
      logger.warn('Embedding sütunu kontrolü atlandı:', err.message);
    }

    // Agents Presence tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS agents_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        socket_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_agent_id UNIQUE (agent_id)
      )
    `);
    logger.info('✅ Agents Presence tablosu oluşturuldu');

    // Agents Presence tablosuna state kolonları ekle
    try {
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents_presence' AND column_name='state') THEN
            ALTER TABLE agents_presence ADD COLUMN state VARCHAR(50) DEFAULT 'available';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents_presence' AND column_name='state_message') THEN
            ALTER TABLE agents_presence ADD COLUMN state_message TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents_presence' AND column_name='state_until') THEN
            ALTER TABLE agents_presence ADD COLUMN state_until TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agents_presence' AND column_name='break_start') THEN
            ALTER TABLE agents_presence ADD COLUMN break_start TIMESTAMP;
          END IF;
        END $$;
      `);
      logger.info('✅ Agents Presence state kolonları eklendi');
    } catch (err) {
      logger.warn('Agents Presence state kolon ekleme atlandı:', err.message);
    }

    // Departments tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Departments tablosu oluşturuldu');

    // Canned Responses tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS canned_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        shortcut VARCHAR(100),
        category VARCHAR(100),
        created_by UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Canned Responses tablosu oluşturuldu');

    // Voice Calls tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS voice_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id),
        agent_id UUID REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'waiting',
        caller_type VARCHAR(50),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        disconnect_reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Voice Calls tablosu oluşturuldu');

    // WebRTC Signaling tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS webrtc_signaling (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voice_call_id UUID REFERENCES voice_calls(id) ON DELETE CASCADE,
        from_type VARCHAR(50), -- 'agent' or 'visitor'
        from_id UUID,
        signal_type VARCHAR(50), -- 'offer', 'answer', 'ice-candidate'
        signal_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ WebRTC Signaling tablosu oluşturuldu');

    // Call Queue tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS call_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voice_call_id UUID REFERENCES voice_calls(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id),
        status VARCHAR(50) DEFAULT 'queued',
        queue_position INTEGER,
        entered_at TIMESTAMP DEFAULT NOW(),
        assigned_at TIMESTAMP
      )
    `);
    logger.info('✅ Call Queue tablosu oluşturuldu');

    // Agent Call Availability tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS agent_call_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        available_for_calls BOOLEAN DEFAULT false,
        max_concurrent_calls INTEGER DEFAULT 1,
        current_calls INTEGER DEFAULT 0,
        total_calls_today INTEGER DEFAULT 0,
        last_call_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Agent Call Availability tablosu oluşturuldu');

    // Widget Settings tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS widget_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
        theme JSONB DEFAULT '{}',
        position VARCHAR(50) DEFAULT 'bottom-right',
        language VARCHAR(10) DEFAULT 'tr',
        welcome_message TEXT,
        offline_message TEXT,
        show_agent_photos BOOLEAN DEFAULT true,
        enable_file_upload BOOLEAN DEFAULT true,
        enable_voice_call BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Widget Settings tablosu oluşturuldu');

    // Notification Preferences tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        email_notifications BOOLEAN DEFAULT true,
        desktop_notifications BOOLEAN DEFAULT true,
        sound_notifications BOOLEAN DEFAULT true,
        new_message_notification BOOLEAN DEFAULT true,
        new_visitor_notification BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Notification Preferences tablosu oluşturuldu');

    // Notification Preferences tablosuna eksik kolonları ekle
    try {
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='email_new_conversation') THEN
            ALTER TABLE notification_preferences ADD COLUMN email_new_conversation BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='email_new_message') THEN
            ALTER TABLE notification_preferences ADD COLUMN email_new_message BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='email_conversation_assigned') THEN
            ALTER TABLE notification_preferences ADD COLUMN email_conversation_assigned BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='email_daily_summary') THEN
            ALTER TABLE notification_preferences ADD COLUMN email_daily_summary BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='browser_new_conversation') THEN
            ALTER TABLE notification_preferences ADD COLUMN browser_new_conversation BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='browser_new_message') THEN
            ALTER TABLE notification_preferences ADD COLUMN browser_new_message BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='browser_conversation_assigned') THEN
            ALTER TABLE notification_preferences ADD COLUMN browser_conversation_assigned BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='sound_enabled') THEN
            ALTER TABLE notification_preferences ADD COLUMN sound_enabled BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='sound_volume') THEN
            ALTER TABLE notification_preferences ADD COLUMN sound_volume INTEGER DEFAULT 50;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_preferences' AND column_name='desktop_enabled') THEN
            ALTER TABLE notification_preferences ADD COLUMN desktop_enabled BOOLEAN DEFAULT true;
          END IF;
        END $$;
      `);
      logger.info('✅ Notification Preferences eksik kolonları eklendi');
    } catch (err) {
      logger.warn('Notification Preferences kolon ekleme atlandı:', err.message);
    }

    // Visitor Sessions tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id),
        session_id VARCHAR(255),
        referrer TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        page_views INTEGER DEFAULT 0,
        duration INTEGER,
        is_active BOOLEAN DEFAULT true
      )
    `);
    logger.info('✅ Visitor Sessions tablosu oluşturuldu');

    // Visitor Sessions tablosuna eksik kolonları ekle
    try {
      await query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitor_sessions' AND column_name='referrer') THEN
            ALTER TABLE visitor_sessions ADD COLUMN referrer TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitor_sessions' AND column_name='is_active') THEN
            ALTER TABLE visitor_sessions ADD COLUMN is_active BOOLEAN DEFAULT true;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitor_sessions' AND column_name='duration_seconds') THEN
            ALTER TABLE visitor_sessions ADD COLUMN duration_seconds INTEGER;
          END IF;
        END $$;
      `);
      logger.info('✅ Visitor Sessions eksik kolonları eklendi');
    } catch (err) {
      logger.warn('Visitor Sessions kolon ekleme atlandı:', err.message);
    }

    // Page Views tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id),
        page_url TEXT NOT NULL,
        page_title TEXT,
        referrer TEXT,
        viewed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Page Views tablosu oluşturuldu');

    // Chat Tags tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS chat_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Chat Tags tablosu oluşturuldu');

    // Conversation Tags tablosu (Many-to-Many)
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        tag_id UUID REFERENCES chat_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, tag_id)
      )
    `);
    logger.info('✅ Conversation Tags tablosu oluşturuldu');

    // Conversation Notes tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Conversation Notes tablosu oluşturuldu');

    // Routing Config tablosu (Smart routing için)
    await query(`
      CREATE TABLE IF NOT EXISTS routing_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE UNIQUE,
        routing_strategy VARCHAR(50) DEFAULT 'round_robin', -- round_robin, least_busy, skill_based
        enable_skill_routing BOOLEAN DEFAULT false,
        enable_department_routing BOOLEAN DEFAULT false,
        enable_vip_routing BOOLEAN DEFAULT false,
        max_queue_size INTEGER DEFAULT 100,
        queue_timeout_minutes INTEGER DEFAULT 30,
        auto_assign BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Routing Config tablosu oluşturuldu');

    // Chat Queue tablosu (voice call_queue gibi ama chat için)
    await query(`
      CREATE TABLE IF NOT EXISTS chat_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        queue_position INTEGER,
        entered_at TIMESTAMP DEFAULT NOW(),
        estimated_wait_minutes INTEGER,
        status VARCHAR(50) DEFAULT 'waiting',
        required_skills TEXT[],
        preferred_department_id UUID REFERENCES departments(id),
        timeout_at TIMESTAMP,
        assigned_at TIMESTAMP
      )
    `);
    logger.info('✅ Chat Queue tablosu oluşturuldu');

    // Business Hours tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS business_hours (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        open_time TIME NOT NULL,
        close_time TIME NOT NULL,
        is_open BOOLEAN DEFAULT true,
        timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Business Hours tablosu oluşturuldu');

    // Offline Messages tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS offline_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        department_id UUID REFERENCES departments(id),
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        contacted_at TIMESTAMP
      )
    `);
    logger.info('✅ Offline Messages tablosu oluşturuldu');

    // Chat Metrics tablosu (Performance tracking)
    await query(`
      CREATE TABLE IF NOT EXISTS chat_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        first_response_time_seconds INTEGER,
        avg_response_time_seconds INTEGER,
        resolution_time_seconds INTEGER,
        customer_satisfaction_score INTEGER,
        total_messages INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Chat Metrics tablosu oluşturuldu');

    // Conversation Assignments tablosu (Routing history için)
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assignment_type VARCHAR(50) DEFAULT 'auto',
        assigned_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Conversation Assignments tablosu oluşturuldu');

    // Chat Transfers tablosu (Transfer history için)
    await query(`
      CREATE TABLE IF NOT EXISTS chat_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        from_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        to_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        transferred_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Chat Transfers tablosu oluşturuldu');

    // Push Subscriptions tablosu (Web Push API için)
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        keys JSONB NOT NULL,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Push Subscriptions tablosu oluşturuldu');

    // Notification Logs tablosu
    await query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        status VARCHAR(20) DEFAULT 'sent',
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Notification Logs tablosu oluşturuldu');

    // Chat Triggers tablosu (Proactive chat için)
    await query(`
      CREATE TABLE IF NOT EXISTS chat_triggers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_config JSONB DEFAULT '{}',
        message TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✅ Chat Triggers tablosu oluşturuldu');

    // İndeksler
    await query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_visitors_session ON visitors(session_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_knowledge_site ON knowledge_base(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_knowledge_content_trgm ON knowledge_base USING gin (content gin_trgm_ops)');
    await query('CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active)');
    await query('CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON notification_logs(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_notif_logs_type ON notification_logs(type)');
    await query('CREATE INDEX IF NOT EXISTS idx_notif_logs_sent ON notification_logs(sent_at)');
    await query('CREATE INDEX IF NOT EXISTS idx_chat_triggers_site ON chat_triggers(site_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_chat_triggers_active ON chat_triggers(is_active)');
    
    // Vector index for similarity search (sadece embedding sütunu varsa)
    try {
      const colCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='knowledge_base' AND column_name='embedding'
      `);
      if (colCheck.rows.length > 0) {
        await query('CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');
        logger.info('✅ Vector index oluşturuldu');
      }
    } catch (err) {
      logger.warn('Vector index oluşturulamadı:', err.message);
    }
    
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

