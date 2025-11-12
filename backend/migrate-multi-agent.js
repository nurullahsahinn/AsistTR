/**
 * Multi-Agent System Migration
 * Adds support for multiple agents, departments, roles, and chat routing
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting multi-agent migration...');
    
    // 1. Create departments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Departments table created');
    
    // 2. Update users table - add department and agent fields
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS max_chats INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS current_chats INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb
    `);
    logger.info('✓ Users table updated with agent fields');
    
    // 3. Update agents_presence table to use UUID
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'agents_presence') THEN
          CREATE TABLE agents_presence (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            socket_id VARCHAR(255),
            status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'away')),
            last_seen TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        END IF;
      END $$;
    `);
    logger.info('✓ Agents presence table created/verified');
    
    // 4. Add routing configuration table
    await client.query(`
      CREATE TABLE IF NOT EXISTS routing_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
        routing_type VARCHAR(50) DEFAULT 'round_robin' CHECK (routing_type IN ('round_robin', 'least_busy', 'skill_based', 'manual')),
        auto_assign BOOLEAN DEFAULT true,
        max_wait_time INTEGER DEFAULT 300,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Routing config table created');
    
    // 5. Add conversation_assignments table (for tracking who handled what)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        unassigned_at TIMESTAMP,
        assignment_type VARCHAR(50) DEFAULT 'auto' CHECK (assignment_type IN ('auto', 'manual', 'transfer'))
      )
    `);
    logger.info('✓ Conversation assignments table created');
    
    // 6. Add agent_availability table for scheduling
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent_id, day_of_week, start_time)
      )
    `);
    logger.info('✓ Agent availability table created');
    
    // 8. Add agent state management table (for breaks, status tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'break', 'offline')),
        on_break BOOLEAN DEFAULT false,
        break_type VARCHAR(50),
        break_reason TEXT,
        break_started_at TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Agent state table created');
    
    // 7. Add indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_presence_agent ON agents_presence(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_presence_status ON agents_presence(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_departments_site ON departments(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conv_assignments_conv ON conversation_assignments(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conv_assignments_agent ON conversation_assignments(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_state_agent ON agent_state(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_state_status ON agent_state(status)');
    logger.info('✓ Indexes created');
    
    // 8. Insert default department for existing agents
    const sitesResult = await client.query('SELECT id, name FROM sites');
    for (const site of sitesResult.rows) {
      await client.query(`
        INSERT INTO departments (site_id, name, description)
        VALUES ($1, 'Default Department', 'Auto-created default department')
        ON CONFLICT DO NOTHING
      `, [site.id]);
    }
    logger.info('✓ Default departments created for existing sites');
    
    // 9. Insert default routing config for existing sites
    for (const site of sitesResult.rows) {
      await client.query(`
        INSERT INTO routing_config (site_id, routing_type, auto_assign)
        VALUES ($1, 'round_robin', true)
        ON CONFLICT (site_id) DO NOTHING
      `, [site.id]);
    }
    logger.info('✓ Default routing configs created');
    
    await client.query('COMMIT');
    logger.info('✅ Multi-agent migration completed successfully!');
    
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
