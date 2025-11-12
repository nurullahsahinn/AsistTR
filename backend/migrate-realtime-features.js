/**
 * Real-time Features Enhancement Migration
 * Adds agent presence, typing status, and visitor tracking
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting real-time features enhancement migration...');
    
    // 1. Agent Presence Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        socket_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        state VARCHAR(20),
        custom_status VARCHAR(255),
        state_until TIMESTAMP,
        last_seen TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Agents presence table created');
    
    // 2. Typing Status Table (for tracking who's typing in which conversation)
    await client.query(`
      CREATE TABLE IF NOT EXISTS typing_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        user_type VARCHAR(20) NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, user_id)
      )
    `);
    logger.info('✓ Typing status table created');
    
    // 3. Add online visitors tracking to visitors table
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='socket_id') THEN
          ALTER TABLE visitors ADD COLUMN socket_id VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='current_page') THEN
          ALTER TABLE visitors ADD COLUMN current_page TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='last_activity') THEN
          ALTER TABLE visitors ADD COLUMN last_activity TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;
    `);
    logger.info('✓ Visitor tracking fields added');
    
    // 4. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_presence_agent ON agents_presence(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_presence_status ON agents_presence(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_typing_status_conv ON typing_status(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_socket ON visitors(socket_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_activity ON visitors(last_activity)');
    logger.info('✓ Indexes created');
    
    // 5. Create default presence for existing agents
    const agentsResult = await client.query(`
      SELECT id FROM users WHERE role IN ('admin', 'agent')
    `);
    
    for (const agent of agentsResult.rows) {
      await client.query(`
        INSERT INTO agents_presence (agent_id, status, last_seen)
        VALUES ($1, 'offline', NOW())
        ON CONFLICT (agent_id) DO NOTHING
      `, [agent.id]);
    }
    
    if (agentsResult.rows.length > 0) {
      logger.info(`✓ Default presence created for ${agentsResult.rows.length} agents`);
    }
    
    await client.query('COMMIT');
    logger.info('✅ Real-time features enhancement migration completed successfully!');
    
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
