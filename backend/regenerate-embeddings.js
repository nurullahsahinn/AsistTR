/**
 * Mevcut bilgi tabanı kayıtları için embedding oluştur
 */

require('dotenv').config({ path: '.env' });
const { query } = require('./src/utils/database');
const { generateEmbedding } = require('./src/rag/ollama.service');
const logger = require('./src/utils/logger');

async function regenerateEmbeddings() {
  try {
    console.log('Embedding olmayan kayıtlar bulunuyor...');
    
    // Embedding olmayan kayıtları getir
    const result = await query(
      `SELECT id, title, content 
       FROM knowledge_base 
       WHERE embedding IS NULL 
       AND is_active = true
       ORDER BY created_at`
    );
    
    const records = result.rows;
    console.log(`Toplam ${records.length} kayıt bulundu.`);
    
    if (records.length === 0) {
      console.log('Tüm kayıtların embedding\'i mevcut!');
      process.exit(0);
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\n[${i + 1}/${records.length}] İşleniyor: ${record.title}`);
      
      try {
        // Embedding oluştur
        const embedding = await generateEmbedding(record.content);
        
        if (!embedding) {
          console.log(`  ⚠️  Embedding oluşturulamadı`);
          failCount++;
          continue;
        }
        
        // Database'e kaydet
        await query(
          `UPDATE knowledge_base 
           SET embedding = $1, updated_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(embedding), record.id]
        );
        
        console.log(`  ✓ Embedding eklendi (${embedding.length} boyut)`);
        successCount++;
        
        // Rate limiting için bekle
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`  ✗ Hata: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('\n=== İşlem Tamamlandı ===');
    console.log(`Başarılı: ${successCount}`);
    console.log(`Başarısız: ${failCount}`);
    console.log(`Toplam: ${records.length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('Fatal hata:', error);
    process.exit(1);
  }
}

// Çalıştır
console.log('=== Embedding Yenileme Başlatılıyor ===\n');
regenerateEmbeddings();
