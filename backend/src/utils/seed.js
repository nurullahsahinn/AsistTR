/**
 * Database Seed Script
 * Demo verileri oluşturur
 */

const bcrypt = require('bcryptjs');
const { query } = require('./database');
const logger = require('./logger');

async function seed() {
  try {
    logger.info('Seed başlıyor...');

    // Admin kullanıcı oluştur
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const adminResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['Admin User', 'admin@asistr.com', passwordHash, 'admin']
    );

    if (adminResult.rows.length > 0) {
      logger.info('✅ Admin kullanıcı oluşturuldu: admin@asistr.com / admin123');
      
      const adminId = adminResult.rows[0].id;

      // Demo site oluştur
      const apiKey = 'demo_qsqx6oi6qnq'; // Fixed API key for testing
      
      const siteResult = await query(
        `INSERT INTO sites (owner_id, name, domain, api_key, settings)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          adminId,
          'Demo E-Ticaret',
          'demo.asistr.com',
          apiKey,
          JSON.stringify({
            theme: 'blue',
            welcomeMessage: 'Merhaba! Size nasıl yardımcı olabiliriz?',
            offlineMessage: 'Şu anda çevrimdışıyız, mesajınızı bırakın.'
          })
        ]
      );

      const siteId = siteResult.rows[0].id;
      logger.info(`✅ Demo site oluşturuldu: ${siteId}`);

      // Demo bilgi tabanı oluştur
      const knowledgeItems = [
        {
          title: 'Kargo Süresi',
          content: 'Kargolarınız 2-3 iş günü içinde tarafınıza teslim edilir. Hızlı kargo seçeneği ile aynı gün kargo da mevcuttur.',
          category: 'shipping'
        },
        {
          title: 'İade Politikası',
          content: 'İade süresi 14 gündür. Bu süre içinde ürünü orijinal ambalajında ve faturasıyla birlikte ücretsiz iade edebilirsiniz.',
          category: 'returns'
        },
        {
          title: 'Ödeme Yöntemleri',
          content: 'Kredi kartı, banka kartı, havale/EFT ve kapıda ödeme seçeneklerimiz mevcuttur. Taksit imkanları için ödeme sayfasını kontrol edebilirsiniz.',
          category: 'payment'
        },
        {
          title: 'Müşteri Hizmetleri Saatleri',
          content: 'Müşteri hizmetlerimiz hafta içi 09:00-18:00 saatleri arasında hizmetinizdedir. Mesajınızı bırakabilirsiniz, en kısa sürede dönüş yapılacaktır.',
          category: 'support'
        },
        {
          title: 'Sipariş Takibi',
          content: 'Siparişinizi "Siparişlerim" sayfasından veya size gönderilen kargo takip numarası ile takip edebilirsiniz.',
          category: 'orders'
        }
      ];

      for (const item of knowledgeItems) {
        await query(
          `INSERT INTO knowledge_base (site_id, title, content, metadata, is_active)
           VALUES ($1, $2, $3, $4, true)`,
          [
            siteId,
            item.title,
            item.content,
            JSON.stringify({ category: item.category })
          ]
        );
      }

      logger.info(`✅ ${knowledgeItems.length} demo bilgi eklendi`);
      
      logger.info('\n📝 Demo Giriş Bilgileri:');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('👑 ADMIN:');
      logger.info('   Email: admin@asistr.com');
      logger.info('   Şifre: admin123');
      logger.info('');
      logger.info(`🔑 API Key: ${apiKey}`);
    } else {
      logger.info('ℹ️  Admin kullanıcı zaten mevcut');
    }
    
    // Demo agent kullanıcı oluştur (her zaman)
    const agentPasswordHash = await bcrypt.hash('agent123', 10);
    
    const agentResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['Agent User', 'agent@asistr.com', agentPasswordHash, 'agent']
    );
    
    if (agentResult.rows.length > 0) {
      logger.info('✅ Demo agent kullanıcı oluşturuldu: agent@asistr.com / agent123');
    } else {
      logger.info('ℹ️  Agent kullanıcı zaten mevcut');
    }
    
    logger.info('\n👤 AGENT:');
    logger.info('   Email: agent@asistr.com');
    logger.info('   Şifre: agent123');

    logger.info('🎉 Seed tamamlandı!');
  } catch (error) {
    logger.error('❌ Seed hatası:', error);
    throw error;
  }
}

// Eğer dosya doğrudan çalıştırılırsa
if (require.main === module) {
  require('dotenv').config();
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seed;

