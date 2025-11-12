/**
 * Main Database Migration
 * Creates core tables for AsistTR
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting main database migration...');
    
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    logger.info('✓ pgvector extension enabled');
    
    // 1. Sites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Sites table created');
    
    // 2. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        password_hash TEXT,
        role VARCHAR(50) DEFAULT 'agent',
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add missing columns if they don't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
    `);
    logger.info('✓ Users table created');
    
    // 3. Visitors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        session_id VARCHAR(255),
        name VARCHAR(255),
        email VARCHAR(255),
        ip_address VARCHAR(45),
        user_agent TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Visitors table created');
    
    // 4. Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'open',
        rating INTEGER,
        feedback_comment TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Conversations table created');
    
    // 5. Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_type VARCHAR(50) NOT NULL,
        sender_id UUID,
        body TEXT,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Messages table created');
    
    // 6. Knowledge Base table
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        embedding vector(768),
        metadata JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Knowledge base table created');
    
    // 7. Widget Sites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS widget_sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) NOT NULL UNIQUE,
        settings JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Widget sites table created');
    
    // 8. Departments table
    await client.query(`
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
    logger.info('✓ Departments table created');
    
    // 9. Canned Responses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS canned_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        shortcut VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        created_by UUID REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Canned responses table created');
    
    // 10. Chat Queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL,
        visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'waiting',
        priority INTEGER DEFAULT 0,
        department_id UUID REFERENCES departments(id),
        entered_at TIMESTAMP DEFAULT NOW(),
        removed_at TIMESTAMP,
        timeout_at TIMESTAMP,
        assigned_agent_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Chat queue table created');
    
    // 11. Offline Messages table  
    await client.query(`
      CREATE TABLE IF NOT EXISTS offline_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        department_id UUID REFERENCES departments(id),
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        contacted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Offline messages table created');
    
    // 12. Chat Metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        first_response_time INTEGER,
        avg_response_time INTEGER,
        total_messages INTEGER DEFAULT 0,
        agent_messages INTEGER DEFAULT 0,
        visitor_messages INTEGER DEFAULT 0,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Chat metrics table created');
    
    // 7. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_sites_api_key ON sites(api_key)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_session ON visitors(session_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_site ON conversations(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_visitor ON conversations(visitor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_knowledge_site ON knowledge_base(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_queue_status ON chat_queue(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_queue_site ON chat_queue(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_queue_visitor ON chat_queue(visitor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_offline_messages_site ON offline_messages(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_offline_messages_status ON offline_messages(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_canned_responses_site ON canned_responses(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_departments_site ON departments(site_id)');
    logger.info('✓ Indexes created');
    
    // 8. Create default site and admin user
    const siteResult = await client.query(`
      INSERT INTO sites (name, domain, api_key)
      VALUES ('AsistTR Demo', 'localhost', '9263706f4e5b2e2b5bb48111b53dea2a48ce23b0928c9a73e39772bc62b68dfc')
      ON CONFLICT (api_key) DO NOTHING
      RETURNING id
    `);
    
    if (siteResult.rows.length > 0) {
      logger.info('✓ Default site created');
      
      const bcrypt = require('bcryptjs');
      const adminPassword = await bcrypt.hash('admin123', 10);
      
      await client.query(`
        INSERT INTO users (site_id, name, email, password, role)
        VALUES ($1, 'Admin User', 'admin@asistr.com', $2, 'admin')
        ON CONFLICT (email) DO NOTHING
      `, [siteResult.rows[0].id, adminPassword]);
      
      logger.info('✓ Default admin user created (email: admin@asistr.com, password: admin123)');
    }
    
    await client.query('COMMIT');
    logger.info('✅ Main database migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  logger.error('Migration error:', err);
  process.exit(1);
});
