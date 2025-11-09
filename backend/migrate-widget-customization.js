/**
 * Widget Customization Migration
 * Adds widget appearance and behavior settings
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting widget customization migration...');
    
    // 1. Widget Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS widget_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
        
        -- Appearance
        primary_color VARCHAR(7) DEFAULT '#0284c7',
        secondary_color VARCHAR(7) DEFAULT '#0369a1',
        text_color VARCHAR(7) DEFAULT '#ffffff',
        position VARCHAR(20) DEFAULT 'bottom-right',
        widget_title VARCHAR(255) DEFAULT 'Chat with us',
        
        -- Welcome & Messages
        welcome_message TEXT DEFAULT 'Hi! How can we help you today?',
        offline_message TEXT DEFAULT 'We are currently offline. Please leave a message.',
        placeholder_text VARCHAR(255) DEFAULT 'Type your message...',
        
        -- Pre-chat Form
        enable_pre_chat_form BOOLEAN DEFAULT false,
        pre_chat_name_required BOOLEAN DEFAULT true,
        pre_chat_email_required BOOLEAN DEFAULT false,
        pre_chat_phone_required BOOLEAN DEFAULT false,
        pre_chat_message_required BOOLEAN DEFAULT false,
        
        -- Business Hours
        enable_business_hours BOOLEAN DEFAULT false,
        business_hours JSONB DEFAULT '{"monday":{"enabled":true,"start":"09:00","end":"18:00"},"tuesday":{"enabled":true,"start":"09:00","end":"18:00"},"wednesday":{"enabled":true,"start":"09:00","end":"18:00"},"thursday":{"enabled":true,"start":"09:00","end":"18:00"},"friday":{"enabled":true,"start":"09:00","end":"18:00"},"saturday":{"enabled":false,"start":"09:00","end":"18:00"},"sunday":{"enabled":false,"start":"09:00","end":"18:00"}}'::jsonb,
        timezone VARCHAR(50) DEFAULT 'UTC',
        
        -- Language
        language VARCHAR(10) DEFAULT 'en',
        
        -- Behavior
        auto_show_delay INTEGER DEFAULT 0,
        show_agent_avatars BOOLEAN DEFAULT true,
        show_typing_indicator BOOLEAN DEFAULT true,
        sound_notifications BOOLEAN DEFAULT true,
        
        -- Branding
        show_branding BOOLEAN DEFAULT true,
        custom_css TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Widget settings table created');
    
    // 2. Create default widget settings for existing sites
    const sitesResult = await client.query('SELECT id FROM sites');
    
    for (const site of sitesResult.rows) {
      await client.query(`
        INSERT INTO widget_settings (site_id)
        VALUES ($1)
        ON CONFLICT (site_id) DO NOTHING
      `, [site.id]);
    }
    
    if (sitesResult.rows.length > 0) {
      logger.info(`✓ Default widget settings created for ${sitesResult.rows.length} sites`);
    }
    
    // 3. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_widget_settings_site ON widget_settings(site_id)');
    logger.info('✓ Indexes created');
    
    await client.query('COMMIT');
    logger.info('✅ Widget customization migration completed successfully!');
    
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
