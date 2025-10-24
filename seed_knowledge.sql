-- AI Bilgi Bankası için Örnek Veriler
-- Site ID: cf418adb-41db-4f73-a50a-deae5b117165

INSERT INTO knowledge_base (site_id, title, content, metadata, is_active) VALUES
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'Fiyatlandırma',
  'AsistTR platformumuz 3 farklı paket sunmaktadır: Temel Paket 99 TL/ay (100 konuşma/ay, 1 agent), Premium Paket 299 TL/ay (500 konuşma/ay, 5 agent, AI asistan), Enterprise Paket 999 TL/ay (Sınırsız konuşma, Sınırsız agent, AI asistan, Özel destek). Tüm paketlerde 14 gün ücretsiz deneme mevcuttur.',
  '{"type": "faq", "category": "pricing", "keywords": ["fiyat", "paket", "ücret", "deneme"]}'::jsonb,
  true
),
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'Teslimat ve Kargo',
  'Siparişleriniz 2-3 iş günü içinde kargoya verilir. Teslimat süresi 3-5 iş günü arasındadır. Hızlı kargo seçeneği ile 1-2 gün içinde ürününüzü teslim alabilirsiniz (ek 30 TL). Kargo ücretsiz gönderim limiti 150 TL ve üzeridir.',
  '{"type": "faq", "category": "shipping", "keywords": ["kargo", "teslimat", "gönderim"]}'::jsonb,
  true
),
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'İptal ve İade Koşulları',
  'Ürünleri teslim aldıktan sonra 14 gün içinde iade edebilirsiniz. İade kargo ücreti tarafımızca karşılanır. Para iadesi 5-7 iş günü içinde banka hesabınıza veya kredi kartınıza yansır. Dijital ürünlerde iade yoktur.',
  '{"type": "faq", "category": "returns", "keywords": ["iade", "iptal", "geri gönderme"]}'::jsonb,
  true
),
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'Çalışma Saatleri',
  'Müşteri hizmetlerimiz Pazartesi-Cuma 09:00-18:00, Cumartesi 10:00-16:00 saatleri arasında hizmetinizdedir. Pazar günleri kapalıyız. Mesai saatleri dışında bıraktığınız mesajlara ilk iş günü yanıt verilecektir.',
  '{"type": "faq", "category": "support", "keywords": ["saat", "mesai", "çalışma"]}'::jsonb,
  true
),
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'İletişim Bilgileri',
  'Email: destek@asistr.com, Telefon: 0850 123 45 67 (Alo Destek Hattı), Adres: Teknokent Binası, Maslak, İstanbul 34485, Türkiye. Whatsapp: +90 555 123 45 67',
  '{"type": "contact", "category": "contact", "keywords": ["iletişim", "telefon", "adres", "email"]}'::jsonb,
  true
),
(
  'cf418adb-41db-4f73-a50a-deae5b117165',
  'Özellikler ve Yetenekler',
  'AsistTR platformu şu özellikleri sunar: Sınırsız widget entegrasyonu, Gerçek zamanlı mesajlaşma, AI destekli otomatik yanıtlar (RAG teknolojisi), Ziyaretçi takibi ve analitik, Mobil uygulama, Çoklu dil desteği, Özelleştirilebilir widget tasarımı, KVKK uyumlu veri saklama.',
  '{"type": "product", "category": "features", "keywords": ["özellik", "yetenek", "fonksiyon"]}'::jsonb,
  true
);

-- Bilgi bankası verilerini kontrol et
SELECT id, title, metadata->>'type' as type, is_active FROM knowledge_base WHERE site_id = 'cf418adb-41db-4f73-a50a-deae5b117165';

