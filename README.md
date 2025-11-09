# 🇹🇷 AsistTR - Yerli ve Milli Canlı Destek Platformu

<div align="center">

**Tawk.to benzeri, RAG teknolojisi ile güçlendirilmiş, self-hosted canlı destek platformu**

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-333333?logo=webrtc)](https://webrtc.org/)

[Demo](#) · [Dokümantasyon](#) · [Özellikler](#-temel-özellikler) · [Kurulum](#-hızlı-başlangıç)

</div>

---

## 🎯 Proje Amacı

**AsistTR**, web sitelerine gömülebilir bir sohbet widget'ı sunarak ziyaretçilerle **gerçek zamanlı** iletişim kurmayı, **sesli arama** yapmayı ve **yapay zeka destekli** otomatik yanıtlar vermeyi sağlayan **açık kaynaklı** bir platformdur.

## ✨ Temel Özellikler

### ✅ Tamamlanan Özellikler

#### 💬 Mesajlaşma & İletişim
- **Gerçek Zamanlı Mesajlaşma**: WebSocket ile anlık iletişim
- **Sesli Arama (WebRTC)**: Widget'tan doğrudan sesli arama başlatma
- **Typing Indicators**: Karşı tarafın yazma durumunu gösterme
- **Mesaj Geçmişi**: Tüm konuşmalar veritabanında saklanır
- **Dosya Gönderimi**: Resim ve belge paylaşımı
- **Session Continuity**: Returning visitor için sohbet devam ettirme

#### 🤖 AI & RAG Sistemi
- **AI Destekli Yanıtlar**: RAG teknolojisi ile akıllı otomatik cevaplar
- **Streaming Yanıtlar**: ChatGPT benzeri karakter karakter metin görüntüleme
- **Markdown Desteği**: Başlıklar, listeler, kalın/italik metin renderı
- **Hibrit Arama**: Text-based + Vector-based bilgi alma
- **pgvector + HNSW Index**: Yüksek performanslı vector search

#### 👥 Agent Yönetimi
- **Çoklu Agent Desteği**: Sınırsız agent ekleyebilme
- **Agent Durumları**: Çevrimiçi, Meşgul, Dışarıda, Molada, Rahatsız Etmeyin
- **Departman Yönetimi**: Agent'ları departmanlara atama
- **Skill-Based Routing**: Yeteneklere göre akıllı yönlendirme
- **Agent Call Availability**: Sesli arama kabul etme durumu
- **Canned Responses**: Hazır yanıt şablonları

#### 🎯 Routing & Queue
- **Round Robin**: Sıralı agent dağıtımı
- **Least Busy**: En az meşgul agent'a yönlendirme
- **Department Routing**: Departman bazlı yönlendirme
- **Call Queue**: Müşteri bekleme kuyruğu
- **Queue Position Tracking**: Kuyruk sırası takibi

#### 🔔 Bildirimler & Analytics
- **Real-time Notifications**: Yeni mesaj ve arama bildirimleri
- **Desktop Notifications**: Tarayıcı bildirimleri
- **Notification Preferences**: Kişiselleştirilebilir bildirim ayarları
- **Page View Tracking**: Ziyaretçi davranış analizi
- **Conversation Metrics**: Sohbet istatistikleri

#### 🎨 Widget
- **Proactive Chat**: Otomatik sohbet başlatma (time, scroll, idle, element visibility triggers)
- **Customizable Widget**: API key bazlı site ayarları
- **Kolay Entegrasyon**: Tek satır kod ile web sitenize ekleyin
- **Responsive Design**: Mobil uyumlu tasarım

#### 🔐 Güvenlik & Yönetim
- **JWT Tabanlı Auth**: Güvenli kimlik doğrulama
- **Role-Based Access**: Admin/Agent rol yönetimi
- **Multi-Site Support**: Tek platformda çoklu site yönetimi
- **API Key Management**: Site bazlı API key kontrolü
- **Rate Limiting**: DDoS koruması


### 🚧 Gelecek Özellikler
- 📈 **Advanced Analytics**: Detaylı performans raporları (CSAT, FRT, ART)
- 🌍 **Multi-Language**: Çoklu dil desteği
- 📱 **Mobil Uygulama**: iOS & Android native app
- 🎨 **Widget Theme Builder**: Görsel özelleştirme paneli
- 📧 **Email Integration**: Offline mesajlar için e-posta yönlendirme
- 🔔 **Push Notifications**: Progressive Web App bildirimleri
- 🤝 **CRM Integration**: Salesforce, HubSpot entegrasyonu
- 📊 **Advanced Queue Management**: Priority queue, timeout, max size

## 🏗️ Mimari

```
Ziyaretçi (Widget)
    ↓ WebSocket + WebRTC
Backend (Node.js + Express + Socket.IO)
    ↓
    ├── Gerçek Zamanlı Mesajlaşma (Socket.IO)
    ├── WebRTC Signaling (Voice Calls)
    ├── REST API (Express)
    ├── RAG Pipeline
    │   ├── Vector Database (pgvector + HNSW)
    │   ├── Embedding (nomic-embed-text)
    │   └── LLM (Ollama llama3.1:8b)
    ├── PostgreSQL 16 + pgvector
    └── Redis 7 (Cache & Session)
    ↓ WebSocket
Admin Dashboard (React)
```

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 18 + Vite 5 + Tailwind CSS 3 |
| **Backend** | Node.js 18 + Express 4 + Socket.IO 4 |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache** | Redis 7 |
| **RAG** | LangChain + pgvector (HNSW index) |
| **LLM** | Ollama (llama3.1:8b) - Local |
| **Embedding** | nomic-embed-text (768 dimensions) |
| **Voice** | WebRTC (Peer-to-Peer) |
| **Auth** | JWT + bcrypt |
| **Deployment** | Docker 24 + Docker Compose 2 |
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




## 📖 Kullanım

### Widget Entegrasyonu

1. **Dashboard'dan API Key alın**
   - http://localhost:3000 adresine giriş yapın
   - Widget Settings sayfasından API Key'inizi kopyalayın

2. **Web sitenize kodu ekleyin**

```html
<script>
(function(){
  var w = window;
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'http://localhost:5173/widget.js';
  s.setAttribute('data-api-key', 'YOUR_API_KEY_HERE');
  var x = document.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s, x);
})();
</script>
```

3. **Özelleştirme (Opsiyonel)**

```html
<script>
(function(){
  var w = window;
  w.AsistTRConfig = {
    apiKey: 'YOUR_API_KEY_HERE',
    primaryColor: '#4F46E5',
    position: 'right', // 'left' or 'right'
    welcomeMessage: 'Merhaba! Size nasıl yardımcı olabilirim?',
    agentName: 'Destek Ekibi',
    proactiveChat: {
      enabled: true,
      timeOnPage: 30, // saniye
      scrollPercentage: 50 // %
    }
  };
  var s = document.createElement('script');
  s.src = 'http://localhost:5173/widget.js';
  document.head.appendChild(s);
})();
</script>
```

### Dashboard Kullanımı

1. **Giriş yapın**: http://localhost:3000
2. **Agent durumunuzu ayarlayın**: Çevrimiçi, Meşgul, Dışarıda, Molada, Rahatsız Etmeyin
3. **Gelen mesajları görüntüleyin**: Sol panelden conversations listesi
4. **Sesli arama kabul edin**: Bildirim geldiğinde Accept butonuna tıklayın
5. **Hazır yanıtları kullanın**: `/` yazarak canned responses'ları görün

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
- `id`, `name`, `email`, `password`, `role` (admin/agent/superadmin)
- `site_id`, `department_id`, `skills` (TEXT[])
- `max_chats`, `current_chats`, `priority_level`
- `created_at`, `updated_at`

#### `sites`
Kayıtlı web siteleri
- `id`, `name`, `domain`, `api_key` (unique)
- `created_at`, `updated_at`

#### `visitors`
Ziyaretçiler
- `id`, `site_id`, `session_id`, `name`, `email`
- `ip_address`, `user_agent`, `meta` (JSON)
- `is_vip`, `language`
- `created_at`, `last_seen`

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
- `agent_id`, `socket_id`
- `status` (online/offline), `state` (Çevrimiçi, Meşgul, Dışarıda, Molada, Rahatsız Etmeyin)
- `state_message`, `state_until`
- `last_seen`

#### `departments`
Departmanlar
- `id`, `site_id`, `name`, `description`
- `created_at`, `updated_at`

#### `voice_calls`
Sesli aramalar
- `id`, `conversation_id`, `visitor_id`, `agent_id`
- `status` (pending/ringing/active/completed/missed/rejected)
- `started_at`, `answered_at`, `ended_at`, `duration`

#### `call_queue`
Arama kuyruğu
- `id`, `conversation_id`, `visitor_id`, `site_id`
- `status` (waiting/assigned/timeout/cancelled)
- `priority`, `queue_position`, `entered_at`

#### `canned_responses`
Hazır yanıtlar
- `id`, `site_id`, `agent_id`, `title`, `content`
- `shortcut`, `created_at`

#### `notification_preferences`
Bildirim tercihleri
- `user_id`, `new_message`, `new_conversation`, `voice_call`
- `desktop_notifications`, `sound_enabled`

#### `agent_call_availability`
Agent sesli arama durumu
- `agent_id`, `is_available`
- `updated_at`

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






---


## 📄 Lisans

MIT License

---

## 👨‍💻 Proje Hakkında

Bu proje **tawk.to benzeri** yerli ve milli bir canlı destek platformudur. Temel özellikler tamamlanmış olup, gelişmiş analitik ve raporlama özellikleri üzerinde çalışılmaktadır.

### 📊 İstatistikler

- **Toplam Kod Satırı**: ~12,000+ LOC
- **Geliştirme Süresi**: 4 ay
- **Servis Sayısı**: 6 (Backend, Dashboard, Widget, PostgreSQL, Redis, Ollama)
- **API Endpoint**: 35+
- **WebSocket Event**: 20+
- **Database Tablo**: 20+
- **React Component**: 40+

### 💡 Kullanım Senaryoları

- E-ticaret siteleri için 7/24 müşteri desteği
- SaaS ürünleri için teknik destek
- Kurumsal şirketler için call center sistemi
- Eğitim platformları için öğrenci danışmanlığı
- Kamu kurumları için vatandaş hizmetleri

---
**Not**: Bu proje aktif geliştirme aşamasındadır. MVP özellikleri tamamlandıkça güncellenecektir.
**Geliştirici**: Nurullah Şahin - Bitirme Projesi 2025


