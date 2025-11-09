/**
 * Visitor Tracking & Analytics Migration
 * Adds visitor profiles, page tracking, sessions, and analytics
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting visitor tracking & analytics migration...');
    
    // 1. Add visitor tracking fields to visitors table
    await client.query(`
      DO $$ 
      BEGIN
        -- IP and Location
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='ip_address') THEN
          ALTER TABLE visitors ADD COLUMN ip_address VARCHAR(45);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='country') THEN
          ALTER TABLE visitors ADD COLUMN country VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='city') THEN
          ALTER TABLE visitors ADD COLUMN city VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='region') THEN
          ALTER TABLE visitors ADD COLUMN region VARCHAR(100);
        END IF;
        
        -- Device & Browser Info
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='browser') THEN
          ALTER TABLE visitors ADD COLUMN browser VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='browser_version') THEN
          ALTER TABLE visitors ADD COLUMN browser_version VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='os') THEN
          ALTER TABLE visitors ADD COLUMN os VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='device_type') THEN
          ALTER TABLE visitors ADD COLUMN device_type VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='user_agent') THEN
          ALTER TABLE visitors ADD COLUMN user_agent TEXT;
        END IF;
        
        -- Session Info
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='first_seen') THEN
          ALTER TABLE visitors ADD COLUMN first_seen TIMESTAMP DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='last_seen') THEN
          ALTER TABLE visitors ADD COLUMN last_seen TIMESTAMP DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='visit_count') THEN
          ALTER TABLE visitors ADD COLUMN visit_count INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visitors' AND column_name='is_online') THEN
          ALTER TABLE visitors ADD COLUMN is_online BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);
    logger.info('✓ Visitor tracking fields added');
    
    // 2. Visitor Sessions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        duration_seconds INTEGER,
        page_views INTEGER DEFAULT 0,
        referrer TEXT,
        landing_page TEXT,
        exit_page TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Visitor sessions table created');
    
    // 3. Page Views Table (Journey Tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        page_url TEXT NOT NULL,
        page_title VARCHAR(255),
        referrer TEXT,
        duration_seconds INTEGER,
        viewed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Page views table created');
    
    // 4. Visitor Events Table (Actions Tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS visitor_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID REFERENCES visitors(id) ON DELETE CASCADE,
        session_id UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE,
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Visitor events table created');
    
    // 5. Analytics Summary Table (Daily aggregations)
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        total_visitors INTEGER DEFAULT 0,
        new_visitors INTEGER DEFAULT 0,
        returning_visitors INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        total_page_views INTEGER DEFAULT 0,
        total_conversations INTEGER DEFAULT 0,
        avg_session_duration INTEGER DEFAULT 0,
        bounce_rate DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(site_id, date)
      )
    `);
    logger.info('✓ Analytics summary table created');
    
    // 6. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor ON visitor_sessions(visitor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site ON visitor_sessions(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_sessions_active ON visitor_sessions(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor ON visitor_events(visitor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitor_events_type ON visitor_events(event_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_summary_site_date ON analytics_summary(site_id, date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_online ON visitors(is_online)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id)');
    logger.info('✓ Indexes created');
    
    await client.query('COMMIT');
    logger.info('✅ Visitor tracking & analytics migration completed successfully!');
    
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
