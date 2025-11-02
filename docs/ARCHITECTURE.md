# 🏗️ AsistTR Mimari Dokümantasyonu

## Genel Bakış

AsistTR, modern mikroservis mimarisine uygun olarak tasarlanmış, ölçeklenebilir bir canlı destek platformudur.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Widget (Ziyaretçi)          Dashboard (Admin)              │
│  - Vanilla JS                - React + Vite                 │
│  - Socket.IO Client          - Zustand (State)              │
│  - Embedded Script           - React Router                 │
└──────────────────┬──────────────────────────┬───────────────┘
                   │                          │
                   ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                    Backend (Node.js)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │   Socket.IO  │  │  RAG Engine  │      │
│  │  (Express)   │  │  (WebSocket) │  │   (Ollama)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Middleware Layer                        │  │
│  │  - Auth (JWT)  - Validation  - Rate Limiting        │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┬───────────────┘
                   │                          │
                   ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        DATA LAYER                            │
├─────────────────────────────────────────────────────────────┤
│   PostgreSQL              Redis              Ollama          │
│   - Conversations         - Cache            - LLM           │
│   - Messages             - Pub/Sub          - Embeddings    │
│   - Users                - Sessions                          │
│   - Knowledge Base       - Presence                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Katmanlar

### 1. Client Layer (İstemci Katmanı)

#### Widget
- **Teknoloji**: Vanilla JavaScript + Socket.IO
- **Görev**: Web sitelerine gömülebilir sohbet arayüzü
- **Özellikler**:
  - Hafif (< 50KB minified)
  - Responsive tasarım
  - Gerçek zamanlı mesajlaşma
  - Özelleştirilebilir tema

#### Dashboard
- **Teknoloji**: React 18 + Vite
- **State Management**: Zustand
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Görev**: Admin paneli ve agent arayüzü

---

### 2. Application Layer (Uygulama Katmanı)

#### REST API
```
src/
├── controllers/    # İş mantığı controller'ları
├── routes/        # Express route tanımları
├── middleware/    # Auth, validation, rate limiting
├── models/        # Veritabanı modelleri
├── services/      # Servis katmanı
└── utils/         # Yardımcı fonksiyonlar
```

**Temel Endpoint'ler**:
- `/api/auth/*` - Kimlik doğrulama
- `/api/chat/*` - Sohbet yönetimi
- `/api/widget/*` - Widget/site yönetimi
- `/api/rag/*` - AI ve bilgi tabanı

#### WebSocket (Socket.IO)
```javascript
// Event-based mimari
socket.on('visitor:connect')   → Ziyaretçi bağlandı
socket.on('agent:connect')     → Agent bağlandı
socket.on('message:send')      → Mesaj gönderildi
socket.emit('message:received') → Mesaj alındı
```

**Room Yapısı**:
- `conversation:{id}` - Belirli bir sohbet odası
- `site:{id}:agents` - Site'nin agent'ları
- `site:{id}` - Site genel odası

#### RAG Engine

```
RAG Pipeline:
1. Kullanıcı sorusu → Embedding oluştur
2. Vector DB'de ara → İlgili bilgileri bul
3. Context + Soru → LLM'e gönder
4. AI yanıtı → Kullanıcıya döndür
```

**Bileşenler**:
- **Knowledge Service**: Bilgi tabanı CRUD
- **Ollama Service**: LLM entegrasyonu
- **RAG Service**: Retrieval + Generation

---

### 3. Data Layer (Veri Katmanı)

#### PostgreSQL
**Tablo Yapısı**:

```sql
users
├── id (uuid)
├── name
├── email
├── password_hash
├── role (admin/agent)
└── created_at

sites
├── id (uuid)
├── owner_id → users(id)
├── name
├── domain
├── api_key
└── settings (jsonb)

visitors
├── id (uuid)
├── site_id → sites(id)
├── session_id
├── name
├── email
└── meta (jsonb)

conversations
├── id (uuid)
├── site_id → sites(id)
├── visitor_id → visitors(id)
├── agent_id → users(id)
├── status (open/closed)
└── created_at

messages
├── id (bigserial)
├── conversation_id → conversations(id)
├── sender_type (visitor/agent/bot)
├── sender_id
├── body
└── created_at

knowledge_base
├── id (uuid)
├── site_id → sites(id)
├── title
├── content
├── embedding (vector)
└── metadata (jsonb)
```

#### Redis
**Kullanım Alanları**:
- Cache (widget settings, user sessions)
- Pub/Sub (Socket.IO multi-server)
- Rate limiting
- Agent presence tracking

#### Ollama
**Modeller**:
- `llama3` - Varsayılan LLM
- `mistral` - Alternatif model
- Embedding: Model içinde

---

## Veri Akışları

### Ziyaretçi Mesaj Gönderme
```
Widget
  │
  ├─ socket.emit('message:send')
  │
  ▼
Socket Handler
  │
  ├─ Validate conversation
  ├─ Save to DB (messages table)
  │
  ▼
Broadcast
  │
  ├─ socket.to('conversation:id')
  ├─ emit('message:received')
  │
  ▼
Agent Dashboard
  │
  └─ Message görüntülenir
```

### AI Yanıt Üretme
```
Agent → "AI öneri al" tıklar
  │
  ▼
POST /api/rag/suggest
  │
  ├─ Sohbet geçmişi al (DB)
  ├─ Bilgi tabanında ara (knowledge_base)
  │     │
  │     ├─ Semantic search (basit: ILIKE)
  │     └─ En alakalı 3 kayıt
  │
  ├─ Context oluştur
  │     │
  │     └─ "Bilgi: X, Y, Z + Soru: ..."
  │
  ▼
Ollama API
  │
  ├─ POST /api/generate
  ├─ Model: llama3
  ├─ Prompt: context + soru
  │
  ▼
AI Yanıtı
  │
  └─ Return to agent (suggestion)
```

---

## Güvenlik Katmanları

### 1. Authentication
- JWT token-based
- Bcrypt password hashing (10 rounds)
- Token expiry: 7 gün
- Refresh token: 30 gün

### 2. Authorization
```javascript
authMiddleware()      // Token kontrolü
adminMiddleware()     // Role kontrolü
```

### 3. Input Validation
- Express Validator
- Sanitization
- XSS koruması

### 4. Rate Limiting
```javascript
authLimiter     → 5 req/15min
apiLimiter      → 100 req/15min
widgetLimiter   → 20 req/min
```

### 5. CORS
```javascript
cors({
  origin: ['http://localhost:3000'],
  credentials: true
})
```

---

## Ölçeklenebilirlik

### Horizontal Scaling

```
┌─────────────┐
│  Load       │
│  Balancer   │
│  (Nginx)    │
└──────┬──────┘
       │
   ┌───┴────┬─────────┬─────────┐
   ▼        ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│Node 1│ │Node 2│ │Node 3│ │Node 4│
└──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
   │        │        │        │
   └────────┴────────┴────────┘
              │
        ┌─────┴─────┐
        ▼           ▼
   ┌────────┐  ┌────────┐
   │ Redis  │  │Postgres│
   │Pub/Sub │  │ Primary│
   └────────┘  └────────┘
```

**Socket.IO Clustering**:
```javascript
// Redis adapter ile multi-server
io.adapter(createAdapter(pubClient, subClient))
```

### Database Scaling

**PostgreSQL**:
- Read replicas için master-slave
- Connection pooling (pg pool)
- Indexing (conversation_id, site_id)

**Redis**:
- Sentinel için HA
- Cluster mode (sharding)

---

## Performans Optimizasyonları

### Backend
- Connection pooling
- Query optimization
- Lazy loading
- Pagination (50 item/page)

### Frontend
- Code splitting
- Lazy imports
- Memoization (React.memo)
- Virtual scrolling (uzun mesaj listeleri)

### Widget
- Minification
- Tree shaking
- CDN hosting
- Gzip compression

---

## Monitoring & Logging

### Logging
```javascript
// Winston logger
logger.info()    → Genel bilgi
logger.warn()    → Uyarılar
logger.error()   → Hatalar
logger.debug()   → Debug bilgisi
```

**Log Dosyaları**:
- `logs/combined.log` - Tüm loglar
- `logs/error.log` - Sadece hatalar

### Future: Monitoring Stack
```
Prometheus → Grafana
    │
    ├─ CPU/Memory metrics
    ├─ Response times
    ├─ Active connections
    └─ Error rates
```

---

## Deployment Mimarisi

### Docker Compose (Development)
```yaml
services:
  - postgres (Database)
  - redis (Cache)
  - backend (API + Socket)
  - dashboard (React SPA)
  - ollama (LLM) [optional]
```

### Production (Kubernetes)
```
┌──────────────────────────────────┐
│         Ingress (HTTPS)          │
└─────────┬───────────────┬────────┘
          │               │
    ┌─────▼─────┐   ┌────▼────┐
    │ Frontend  │   │ Backend │
    │  (Nginx)  │   │ Pods x3 │
    └───────────┘   └─────┬───┘
                          │
              ┌───────────┴────────┐
              ▼                    ▼
         ┌─────────┐         ┌──────────┐
         │Postgres │         │  Redis   │
         │StatefulSet│       │StatefulSet│
         └─────────┘         └──────────┘
```

---

## Teknoloji Kararları

### Neden Node.js?
- Non-blocking I/O (gerçek zamanlı için ideal)
- Socket.IO desteği
- Hızlı geliştirme
- Büyük ekosistem

### Neden PostgreSQL?
- ACID compliance
- JSON support (settings, metadata)
- Güçlü indexing
- Vector extension desteği (pgvector)

### Neden Ollama?
- Yerel çalışma (maliyet yok)
- Veri gizliliği
- Özelleştirilebilir modeller
- Kolay kurulum

### Neden Socket.IO?
- Fallback mekanizması
- Room desteği
- Broadcasting
- Reconnection handling

---

## Gelecek İyileştirmeler

### Kısa Vade (1-3 ay)
- [ ] Email notifications
- [ ] File upload (resim, dosya)
- [ ] Canned responses
- [ ] Typing indicators
- [ ] Read receipts

### Orta Vade (3-6 ay)
- [ ] Mobile app (React Native)
- [ ] Video/Voice call
- [ ] Advanced analytics
- [ ] CRM entegrasyonu
- [ ] Multi-language support

### Uzun Vade (6-12 ay)
- [ ] AI training pipeline
- [ ] Sentiment analysis
- [ ] Auto-tagging
- [ ] Chatbot builder
- [ ] WhatsApp entegrasyonu




