/**
 * Advanced Chat Features Migration
 * Adds canned responses, chat tags, notes, and feedback
 */

const { pool } = require('./src/utils/database');
const logger = require('./src/utils/logger');

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    logger.info('Starting advanced chat features migration...');
    
    // 1. Canned Responses Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS canned_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        shortcut VARCHAR(50),
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Canned responses table created');
    
    // 2. Chat Tags Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(site_id, name)
      )
    `);
    logger.info('✓ Chat tags table created');
    
    // 3. Conversation Tags (Many-to-Many)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        tag_id UUID REFERENCES chat_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(conversation_id, tag_id)
      )
    `);
    logger.info('✓ Conversation tags table created');
    
    // 4. Conversation Notes (Internal)
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Conversation notes table created');
    
    // 5. Add feedback fields to conversations
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='conversations' AND column_name='feedback_comment'
        ) THEN
          ALTER TABLE conversations 
          ADD COLUMN feedback_comment TEXT,
          ADD COLUMN feedback_created_at TIMESTAMP;
        END IF;
      END $$;
    `);
    logger.info('✓ Feedback fields added to conversations');
    
    // 6. Chat Transfer History
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        from_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        to_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        transferred_at TIMESTAMP DEFAULT NOW()
      )
    `);
    logger.info('✓ Chat transfers table created');
    
    // 7. Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_canned_site ON canned_responses(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_canned_shortcut ON canned_responses(shortcut)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tags_site ON chat_tags(site_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conv_tags_conv ON conversation_tags(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notes_conv ON conversation_notes(conversation_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transfers_conv ON chat_transfers(conversation_id)');
    logger.info('✓ Indexes created');
    
    // 8. Insert default canned responses
    const sitesResult = await client.query('SELECT id FROM sites LIMIT 1');
    if (sitesResult.rows.length > 0) {
      const siteId = sitesResult.rows[0].id;
      
      const defaultResponses = [
        { title: 'Hoş Geldiniz', content: 'Merhaba! Size nasıl yardımcı olabilirim?', shortcut: '/hello', category: 'greeting' },
        { title: 'Bekleyin', content: 'Bir dakika lütfen, kontrol ediyorum...', shortcut: '/wait', category: 'common' },
        { title: 'Teşekkürler', content: 'Yardımcı olabildiysek ne mutlu bize! İyi günler dileriz.', shortcut: '/thanks', category: 'closing' },
        { title: 'Email Sor', content: 'Size e-posta ile bilgi gönderebilmemiz için e-posta adresinizi paylaşır mısınız?', shortcut: '/email', category: 'common' },
        { title: 'Destek Saatleri', content: 'Destek ekibimiz Pazartesi-Cuma 09:00-18:00 saatleri arasında hizmetinizdedir.', shortcut: '/hours', category: 'info' }
      ];
      
      for (const response of defaultResponses) {
        await client.query(`
          INSERT INTO canned_responses (site_id, title, content, shortcut, category)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [siteId, response.title, response.content, response.shortcut, response.category]);
      }
      
      logger.info('✓ Default canned responses created');
      
      // Insert default tags
      const defaultTags = [
        { name: 'Urgent', color: '#EF4444' },
        { name: 'Bug', color: '#F59E0B' },
        { name: 'Feature Request', color: '#3B82F6' },
        { name: 'Question', color: '#8B5CF6' },
        { name: 'Resolved', color: '#10B981' }
      ];
      
      for (const tag of defaultTags) {
        await client.query(`
          INSERT INTO chat_tags (site_id, name, color)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [siteId, tag.name, tag.color]);
      }
      
      logger.info('✓ Default tags created');
    }
    
    await client.query('COMMIT');
    logger.info('✅ Advanced chat features migration completed successfully!');
    
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
