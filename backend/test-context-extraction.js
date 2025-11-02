/**
 * Context Extraction Test
 * Her soru için doğru context bulunuyor mu?
 */

require('dotenv').config({ path: '.env' });
const { generateRagResponse } = require('./src/rag/rag.service');

const testQueries = [
  'Konteyner Teknolojisi Nedir?',
  'Docker Nedir?',
  'Konteynerler Nasıl Çalışır?',
  'Konteyner Teknolojisinin Avantajları Nelerdir?',
  'Konteyner Teknolojisinin Dezavantajları Nelerdir?',
  'Bulutta Konteyner Hizmetleri Nelerdir?'
];

async function runTests() {
  // Gerçek conversation ID gerekiyor
  console.log('⚠️  DİKKAT: Bu test için gerçek bir conversation_id lazım');
  console.log('Widget\'tan bir sohbet başlatın ve conversation_id\'yi buraya yazın\n');
  
  // Demo için sadece ne yapacağını göster
  console.log('=== TEST SORULARI ===\n');
  testQueries.forEach((q, i) => {
    console.log(`${i + 1}. ${q}`);
  });
  
  console.log('\n=== TEST NASIL YAPILIR ===');
  console.log('1. Widget\'ı açın (test-widget.html)');
  console.log('2. Yukarıdaki soruları sırayla sorun');
  console.log('3. Backend loglarını izleyin: docker logs -f asistr_backend');
  console.log('4. "Knowledge context" ve "En uygun bölüm" loglarına bakın\n');
  
  process.exit(0);
}

runTests();
