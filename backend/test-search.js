/**
 * Arama testini manual olarak yap
 */

require('dotenv').config({ path: '.env' });
const { searchKnowledge } = require('./src/rag/knowledge.service');

async function testSearch() {
  try {
    console.log('=== ARAMA TESTİ ===\n');
    
    const siteId = '0a1a9285-eeb1-4308-8148-580071bfce0b'; // Demo site
    const query = 'Konteyner teknolojisi nedir?';
    
    console.log(`Site ID: ${siteId}`);
    console.log(`Sorgu: ${query}\n`);
    
    const results = await searchKnowledge(siteId, query, 3);
    
    console.log(`\n✅ ${results.length} sonuç bulundu:\n`);
    
    results.forEach((result, idx) => {
      console.log(`--- Sonuç ${idx + 1} ---`);
      console.log(`Title: ${result.title}`);
      console.log(`Content (ilk 200 karakter):`);
      console.log(result.content.substring(0, 200));
      if (result.similarity) {
        console.log(`Similarity: ${result.similarity}`);
      }
      console.log('');
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('Hata:', error);
    process.exit(1);
  }
}

testSearch();
