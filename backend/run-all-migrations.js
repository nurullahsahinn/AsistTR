/**
 * Run All Migrations Script
 * Tüm migration dosyalarını sırayla çalıştırır
 */

const { execSync } = require('child_process');
const logger = require('./src/utils/logger');

const migrations = [
  { name: 'Ana Migration', file: 'migrate.js' },
  { name: 'Voice Calls', file: 'migrate-voice-calls.js' },
  { name: 'Advanced Chat', file: 'migrate-advanced-chat.js' },
  { name: 'Chat Triggers', file: 'migrate-chat-triggers.js' },
  { name: 'Realtime Features', file: 'migrate-realtime-features.js' },
  { name: 'Multi-Agent', file: 'migrate-multi-agent.js' },
  { name: 'Widget Customization', file: 'migrate-widget-customization.js' },
  { name: 'Notification System', file: 'migrate-notification-system.js' },
  { name: 'Visitor Analytics', file: 'migrate-visitor-analytics.js' },
  { name: 'Vector Index', file: 'create-vector-index.js' }
];

async function runMigrations() {
  console.log('\n🚀 Tüm Migration\'lar Çalıştırılıyor...\n');
  console.log('='.repeat(60));
  
  let successCount = 0;
  let failCount = 0;
  
  for (const migration of migrations) {
    try {
      console.log(`\n📦 ${migration.name} çalıştırılıyor...`);
      execSync(`node ${migration.file}`, { 
        stdio: 'inherit',
        cwd: __dirname
      });
      console.log(`✅ ${migration.name} - BAŞARILI`);
      successCount++;
    } catch (error) {
      console.log(`⚠️  ${migration.name} - ATLANDI (zaten çalışmış olabilir)`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 ÖZET:');
  console.log(`   ✅ Başarılı: ${successCount}`);
  console.log(`   ⚠️  Atlanan: ${failCount}`);
  console.log(`   📦 Toplam: ${migrations.length}`);
  console.log('\n🎉 Tüm migration işlemleri tamamlandı!\n');
}

runMigrations().catch(error => {
  console.error('❌ Migration hatası:', error);
  process.exit(1);
});
