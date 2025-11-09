/**
 * Notification System Migration
 * Adds notification preferences and push subscriptions
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting notification system migration...');
    
    // 1. Notification Preferences Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        
        -- Email Notifications
        email_new_conversation BOOLEAN DEFAULT true,
        email_new_message BOOLEAN DEFAULT true,
        email_conversation_assigned BOOLEAN DEFAULT true,
        email_daily_summary BOOLEAN DEFAULT false,
        
        -- Browser Notifications
        browser_new_conversation BOOLEAN DEFAULT true,
        browser_new_message BOOLEAN DEFAULT true,
        browser_conversation_assigned BOOLEAN DEFAULT true,
        
        -- Sound Notifications
        sound_enabled BOOLEAN DEFAULT true,
        sound_volume INTEGER DEFAULT 70,
        
        -- Desktop Notifications
        desktop_enabled BOOLEAN DEFAULT true,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Notification preferences table created');
    
    // 2. Push Subscriptions Table (for Web Push API)
    await client.query(`
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
    logger.info('✓ Push subscriptions table created');
    
    // 3. Notification Log Table
    await client.query(`
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
    logger.info('✓ Notification logs table created');
    
    // 4. Create default preferences for existing users
    const usersResult = await client.query('SELECT id FROM users');
    
    for (const user of usersResult.rows) {
      await client.query(`
        INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [user.id]);
    }
    
    if (usersResult.rows.length > 0) {
      logger.info(`✓ Default notification preferences created for ${usersResult.rows.length} users`);
    }
    
    // 5. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notif_logs_user ON notification_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notif_logs_type ON notification_logs(type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notif_logs_sent ON notification_logs(sent_at)');
    logger.info('✓ Indexes created');
    
    await client.query('COMMIT');
    logger.info('✅ Notification system migration completed successfully!');
    
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
