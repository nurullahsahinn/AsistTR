# 🇹🇷 AsistTR - Yerli ve Milli Canlı Destek Platformu

**AsistTR**, Tawk.to benzeri yerli canlı destek platformudur ve RAG (Retrieval-Augmented Generation) teknolojisi ile güçlendirilmiştir.

## 🎯 Proje Amacı

Web sitelerine gömülebilir bir sohbet widget'ı sunarak ziyaretçilerle **gerçek zamanlı** iletişim kurmayı ve **yapay zeka destekli** otomatik yanıtlar vermeyi sağlar.

## ✨ Temel Özellikler

### ✅ Tamamlanan Özellikler
- 💬 **Gerçek Zamanlı Mesajlaşma**: WebSocket ile anlık iletişim
- 🤖 **AI Destekli Yanıtlar**: RAG teknolojisi ile akıllı otomatik cevaplar
- 📊 **Admin Dashboard**: Agent paneli, sohbet yönetimi
- 🔐 **Güvenli Kimlik Doğrulama**: JWT tabanlı auth sistemi
- 💾 **Mesaj Geçmişi**: Tüm konuşmalar veritabanında saklanır
- 🌍 **Kolay Entegrasyon**: Tek satır kod ile web sitenize ekleyin
- ⏱️ **Streaming Yanıtlar**: ChatGPT benzeri karakter karakter metin görüntüleme
- 📝 **Markdown Desteği**: Başlıklar, listeler, kalın/italik metin renderı
- 🔄 **Otomatik Güncelleme**: Tüm mesajlar ve sohbetler anlık güncellenir
- 📦 **Dosya Gönderimi**: Resim ve belge paylaşımı
- 🧠 **Hibrit Arama**: Text-based + Vector-based bilgi alma


### Gelecek Özellikler
- 📈 **Analitik & Raporlama**: Detaylı istatistikler
- 👥 **Çoklu Agent Desteği**: Ekip yönetimi
- 📱 **Mobil Uygulama**: iOS & Android
- 🎨 **Widget Özelleştirme**: Tema, renk, dil seçenekleri
- 📧 **E-posta Entegrasyonu**: Offline mesaj desteği
- 🔔 **Push Bildirimler**: Anlık uyarılar

## 🏗️ Mimari

```
Ziyaretçi (Widget)
    ↓
Backend (Node.js + Express + Socket.IO)
    ↓
    ├── Gerçek Zamanlı Mesajlaşma
    ├── REST API
    ├── RAG Pipeline
    │   ├── Vector Database (FAISS/Pinecone)
    │   ├── Embedding (OpenAI/Local Model)
    │   └── LLM (GPT-4/Llama/Mistral)
    └── PostgreSQL + Redis
    ↓
Admin Dashboard (React)
```

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Node.js + Express.js + Socket.IO |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache** | Redis 7 |
| **RAG** | LangChain + pgvector (HNSW index) |
| **LLM** | Ollama (llama3.1:8b) - Local |
| **Embedding** | nomic-embed-text (768 dimensions) |
| **Auth** | JWT + bcrypt |
| **Deployment** | Docker + Docker Compose |
| **Real-time** | WebSocket / Socket.IO |

## 📁 Proje Yapısı

```
AsistTR/
├── backend/              # Node.js API sunucusu
│   ├── src/
│   │   ├── controllers/  # API controller'lar
│   │   ├── models/       # Veritabanı modelleri
│   │   ├── routes/       # API route'lar
│   │   ├── services/     # İş mantığı servisleri
│   │   ├── middleware/   # Auth, validation vb.
│   │   ├── socket/       # WebSocket handlers
│   │   └── rag/          # RAG pipeline
│   ├── app.js
│   └── package.json
│
├── frontend/             # React Dashboard
│   ├── dashboard/        # Admin paneli
│   └── widget/           # Ziyaretçi sohbet widget'ı
│
├── docs/                 # Dokümantasyon
│   ├── architecture.md
│   ├── api-spec.md
│   └── setup-guide.md
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Docker 24+
- Docker Compose 2.20+
- 8GB RAM (minimum)
- 20GB Disk Alanı

### Kurulum

1. **Projeyi Klonlayın**
```bash
git clone https://github.com/[kullanici]/AsistTR.git
cd AsistTR
```

2. **Environment Variables**
```bash
cp backend/.env.example backend/.env
# .env dosyasını düzenleyin
```

3. **Docker ile Çalıştırma** (Önerilen)
```bash
# Tüm servisleri başlat
docker-compose up -d

# Ollama modellerini yükle
docker exec -i asistr_ollama ollama pull llama3.1:8b
docker exec -i asistr_ollama ollama pull nomic-embed-text:latest

# Veritabanı migration
docker exec -i asistr_backend node migrate.js

# Bilgi tabanı seed (isteğe bağlı)
docker exec -i asistr_postgres psql -U asistr_user -d asistr_db -f /seed_knowledge.sql

# Vector index oluştur (performans için)
docker exec -i asistr_backend node create-vector-index.js

# Embeddings oluştur
docker exec -i asistr_backend node regenerate-embeddings.js
```

4. **Servislere Erişin**
- Dashboard: http://localhost:3000
- Widget Test: http://localhost:5173/test-widget.html
- Backend API: http://localhost:4000
- Ollama: http://localhost:11434



## 📖 Kullanım

### Widget Entegrasyonu

Web sitenize aşağıdaki kodu ekleyin:

```html
<script>
(function(){
  var w = window;
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'https://asistr.com/widget.js';
  s.setAttribute('data-widget-id', 'WIDGET_ID_BURAYA');
  var x = document.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s, x);
})();
</script>
```

## 🧠 RAG Nasıl Çalışır?

### Hibrit Arama Stratejisi

AsistTR, hem **text-based** hem de **vector-based** arama kullanır:

1. **Bilgi Tabanı Oluşturma**: FAQ'ler, dökümanlar sisteme yüklenir
2. **Vektörleştirme**: Metinler embedding'lere dönüştürülür (nomic-embed-text, 768 boyut)
3. **Saklama**: PostgreSQL pgvector eklentisi ile HNSW index kullanılır
4. **Hibrit Sorgulama**: 
   - Text-based arama: Anahtar kelime eşleşmesi (70% ağırlık)
   - Vector-based arama: Semantik benzerlik (30% ağırlık)
5. **Context Oluşturma**: En alakalı paragraflar seçilir (1500 karakter)
6. **Yanıt Üretimi**: Ollama llama3.1:8b, streaming olarak markdown cevap üretir

### RAG Akış Örneği

```
Kullanıcı: "İade süresi kaç gün?"
    ↓
Embedding Oluştur (nomic-embed-text)
    ↓
Hibrit Arama:
  - Text: "iade süresi" keyword match
  - Vector: Cosine similarity search
    ↓
Bulunan: "İade süresi 14 gündür. Kargo ücretsizdir."
    ↓
LLM Prompt (llama3.1:8b):
  "Aşağıdaki metinde yanıt var. Metni AYNEN kullan ve MARKDOWN formatında yaz.
   METİN: [bulunan bilgi]
   Soru: İade süresi kaç gün?"
    ↓
AI Yanıtı (Streaming + Markdown):
  "## İade Süresi
   
   İade süremiz **14 gün**dür. 
   
   - Kargo ücreti **ücretsiz**dir
   - Fatura ile iade edilmelidir"
```

### Performans Optimizasyonları

- **HNSW Index**: pgvector ile hızlı vector arama
- **Keyword-based Paragraph Selection**: En alakalı paragraf seçimi
- **Context Window**: 1500 karakter limit
- **Streaming Response**: Anlık yanıt görüntüleme
- **Temperature: 0.1**: Deterministik yanıtlar

## 🛡️ Güvenlik

- ✅ JWT tabanlı kimlik doğrulama
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Rate limiting (100 req/15min)
- ✅ Input sanitization
- ✅ XSS & CSRF koruması
- ✅ HTTPS/WSS zorunlu (production)
- ✅ KVKK uyumlu veri saklama (Türkiye)
- ✅ Role-based access control (Admin/Agent)
- ✅ SQL injection koruması (parameterized queries)
- ✅ CORS policy (whitelisted domains)

## 📊 Veritabanı Şeması

### Ana Tablolar

#### `users`
Admin/Agent kullanıcılar
- `id`, `name`, `email`, `password`, `role` (admin/agent)
- `created_at`, `updated_at`

#### `sites`
Kayıtlı web siteleri
- `id`, `name`, `domain`, `api_key` (unique)
- `created_at`, `updated_at`

#### `visitors`
Ziyaretçiler
- `id`, `site_id`, `session_id`, `name`, `email`
- `ip_address`, `user_agent`, `meta` (JSON)
- `created_at`

#### `conversations`
Sohbet oturumları
- `id`, `site_id`, `visitor_id`, `agent_id`
- `status` (open/closed), `rating`, `closed_at`
- `created_at`, `updated_at`

#### `messages`
Mesajlar
- `id`, `conversation_id`, `sender_type` (visitor/agent/bot)
- `sender_id`, `body`, `attachments` (JSON)
- `is_read`, `created_at`

#### `knowledge_base`
RAG bilgi tabanı
- `id`, `site_id`, `title`, `content`
- `embedding` (vector(768)), `tags`
- `created_at`, `updated_at`

#### `agents_presence`
Agent çevrimiçi durumu
- `agent_id`, `socket_id`, `status` (online/offline)
- `last_seen`

### Index'ler

```sql
-- Vector similarity search (HNSW)
CREATE INDEX knowledge_base_embedding_idx 
ON knowledge_base 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Performance indexes
CREATE INDEX idx_conversations_site_status ON conversations(site_id, status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_visitors_session ON visitors(site_id, session_id);
```

## 🔧 Geliştirme Komutları

### Container Yönetimi
```bash
# Tüm servisleri başlat
docker-compose up -d

# Servisleri durdur
docker-compose down

# Logları gör
docker-compose logs -f [servis-adi]

# Container'a gir
docker exec -it asistr_backend sh

# Yeniden build (cache temizleyerek)
docker-compose build --no-cache [servis-adi]
```

### Backend Komutları
```bash
# Migration çalıştır
docker exec -i asistr_backend node migrate.js

# Embeddings oluştur
docker exec -i asistr_backend node regenerate-embeddings.js

# Vector index oluştur
docker exec -i asistr_backend node create-vector-index.js

# Backend logları
docker logs -f asistr_backend
```

### Ollama Komutları
```bash
# Model listesi
docker exec -i asistr_ollama ollama list

# Model yükle
docker exec -i asistr_ollama ollama pull llama3.1:8b

# Model test
docker exec -i asistr_ollama ollama run llama3.1:8b "Merhaba"
```

### Veritabanı Komutları
```bash
# PostgreSQL'e bağlan
docker exec -it asistr_postgres psql -U asistr_user -d asistr_db

# Backup al
docker exec asistr_postgres pg_dump -U asistr_user asistr_db > backup.sql

# Restore
docker exec -i asistr_postgres psql -U asistr_user -d asistr_db < backup.sql
```


## 🤝 Katkıda Bulunma

Bu proje bir bitirme projesidir. Önerileriniz için issue açabilirsiniz.

## 📄 Lisans

MIT License

## 👨‍💻 Geliştirici

Nurullah Şahin - Bitirme Projesi - 2025

### Teknolojiler

- **Frontend**: React 18, Vite 5, Tailwind CSS 3
- **Backend**: Node.js 18, Express 4, Socket.IO 4
- **Database**: PostgreSQL 16 (pgvector), Redis 7
- **AI/ML**: Ollama (llama3.1:8b), nomic-embed-text
- **DevOps**: Docker 24, Docker Compose 2

### Proje İstatistikleri

- **Toplam Kod Satırı**: ~8,000+ LOC
- **Geliştirme Süresi**: 3 ay
- **Servis Sayısı**: 6 (Backend, Dashboard, Widget, Postgres, Redis, Ollama)
- **Endpoint Sayısı**: 25+
- **WebSocket Event**: 15+

---

**Not**: Bu proje aktif geliştirme aşamasındadır. MVP özellikleri tamamlandıkça güncellenecektir.


