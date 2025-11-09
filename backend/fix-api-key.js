/**
 * API Key Fix Script
 * Demo site'ın API key'ini sabit değere günceller
 */

require('dotenv').config();
const { query } = require('./src/utils/database');

async function fixApiKey() {
  try {
    console.log('🔧 API Key güncelleniyor...');
    
    const result = await query(
      `UPDATE sites 
       SET api_key = 'demo_qsqx6oi6qnq' 
       WHERE name = 'Demo E-Ticaret'
       RETURNING id, name, api_key`,
      []
    );
    
    if (result.rows.length > 0) {
      console.log('✅ API Key güncellendi:');
      console.log(`   Site: ${result.rows[0].name}`);
      console.log(`   API Key: ${result.rows[0].api_key}`);
    } else {
      console.log('ℹ️  Demo site bulunamadı, seed script çalıştırın');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

fixApiKey();

