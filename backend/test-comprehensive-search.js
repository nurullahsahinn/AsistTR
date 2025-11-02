/**
 * Kapsamlı Arama Testi
 * Farklı soru tipleriyle test
 */

require('dotenv').config({ path: '.env' });
const { searchKnowledge } = require('./src/rag/knowledge.service');

const testQueries = [
  'Konteyner teknolojisi nedir?',
  'Kargo ne kadar sürede gelir?',
  'İade nasıl yaparım?',
  'Hangi ödeme yöntemleri var?',
  'Container nedir?', // İngilizce
  'VM ile konteyner farkı nedir?'
];

async function runTests() {
  const siteId = '0a1a9285-eeb1-4308-8148-580071bfce0b'; // Demo site
  
  console.log('=== KAPSAMLI ARAMA TESTİ ===\n');
  console.log(`Site ID: ${siteId}`);
  console.log(`Test sayısı: ${testQueries.length}\n`);
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TEST ${i + 1}/${testQueries.length}: "${query}"`);
    console.log('='.repeat(60));
    
    try {
      const results = await searchKnowledge(siteId, query, 2);
      
      if (results.length === 0) {
        console.log('❌ Sonuç bulunamadı!\n');
      } else {
        console.log(`✅ ${results.length} sonuç bulundu:\n`);
        
        results.forEach((result, idx) => {
          console.log(`  ${idx + 1}. ${result.title}`);
          const preview = result.content.substring(0, 100).replace(/\n/g, ' ');
          console.log(`     "${preview}..."`);
          if (result.similarity) {
            console.log(`     Similarity: ${result.similarity.toFixed(4)}`);
          }
          console.log('');
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error(`❌ Hata: ${error.message}\n`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST TAMAMLANDI');
  console.log('='.repeat(60) + '\n');
  
  process.exit(0);
}

runTests();
