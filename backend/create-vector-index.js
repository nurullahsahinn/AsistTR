/**
 * Vector Search İçin Index Oluştur
 * HNSW (Hierarchical Navigable Small World) index
 * Daha hızlı vector similarity search için
 */

require('dotenv').config({ path: '.env' });
const { query } = require('./src/utils/database');

async function createVectorIndex() {
  try {
    console.log('=== Vector Index Oluşturuluyor ===\n');
    
    // 1. Mevcut index'i kontrol et
    console.log('Mevcut index\'ler kontrol ediliyor...');
    const existingIndexes = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'knowledge_base' 
      AND indexname LIKE '%embedding%'
    `);
    
    if (existingIndexes.rows.length > 0) {
      console.log('Mevcut embedding index\'leri:');
      existingIndexes.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
      
      console.log('\nEski index siliniyor...');
      for (const row of existingIndexes.rows) {
        await query(`DROP INDEX IF EXISTS ${row.indexname}`);
        console.log(`  ✓ ${row.indexname} silindi`);
      }
    }
    
    // 2. HNSW index oluştur
    console.log('\n📊 HNSW index oluşturuluyor...');
    console.log('Bu işlem birkaç dakika sürebilir...\n');
    
    await query(`
      CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
      ON knowledge_base 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    
    console.log('✅ Index başarıyla oluşturuldu!\n');
    
    // 3. İstatistikleri güncelle
    console.log('İstatistikler güncelleniyor...');
    await query('ANALYZE knowledge_base');
    console.log('✓ İstatistikler güncellendi\n');
    
    // 4. Sonuç özeti
    const stats = await query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(embedding) as records_with_embedding,
        COUNT(*) - COUNT(embedding) as records_without_embedding
      FROM knowledge_base
    `);
    
    console.log('=== Özet ===');
    console.log(`Toplam kayıt: ${stats.rows[0].total_records}`);
    console.log(`Embedding ile: ${stats.rows[0].records_with_embedding}`);
    console.log(`Embedding olmadan: ${stats.rows[0].records_without_embedding}`);
    
    if (stats.rows[0].records_without_embedding > 0) {
      console.log('\n⚠️  Bazı kayıtlarda embedding yok!');
      console.log('Şu komutu çalıştırın: docker exec -i asistr_backend node regenerate-embeddings.js');
    }
    
    console.log('\n✅ İşlem tamamlandı!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createVectorIndex();
