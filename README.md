# 🇹🇷 AsistTR - Yerli ve Milli Canlı Destek Platformu

**AsistTR**, Tawk.to benzeri yerli canlı destek platformudur ve RAG (Retrieval-Augmented Generation) teknolojisi ile güçlendirilmiştir.

## 🎯 Proje Amacı

Web sitelerine gömülebilir bir sohbet widget'ı sunarak ziyaretçilerle **gerçek zamanlı** iletişim kurmayı ve **yapay zeka destekli** otomatik yanıtlar vermeyi sağlar.

## ✨ Temel Özellikler

### MVP Özellikleri
- 💬 **Gerçek Zamanlı Mesajlaşma**: WebSocket ile anlık iletişim
- 🤖 **AI Destekli Yanıtlar**: RAG teknolojisi ile akıllı otomatik cevaplar
- 📊 **Admin Dashboard**: Agent paneli, sohbet yönetimi
- 🔐 **Güvenli Kimlik Doğrulama**: JWT tabanlı auth sistemi
- 💾 **Mesaj Geçmişi**: Tüm konuşmalar veritabanında saklanır
- 🌍 **Kolay Entegrasyon**: Tek satır kod ile web sitenize ekleyin
- 🇹🇷 **KVKK Uyumlu**: Veriler Türkiye'de saklanır

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
| **Frontend** | React + Next.js + Tailwind CSS |
| **Backend** | Node.js + Express.js + Socket.IO |
| **Database** | PostgreSQL + Redis |
| **RAG** | LangChain + FAISS/Pinecone |
| **LLM** | OpenAI GPT-4 / Ollama (Local) |
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
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker (opsiyonel)

### Kurulum

1. **Projeyi Klonlayın**
```bash
git clone https://github.com/[kullanici]/AsistTR.git
cd AsistTR
```

2. **Environment Variables**
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

3. **Docker ile Çalıştırma** (Önerilen)
```bash
docker-compose up -d
```

4. **Manuel Kurulum**

Backend:
```bash
cd backend
npm install
npm run migrate
npm run dev
```

Frontend Dashboard:
```bash
cd frontend/dashboard
npm install
npm run dev
```

Widget:
```bash
cd frontend/widget
npm install
npm run build
```

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

1. **Bilgi Tabanı Oluşturma**: FAQ'ler, dökümanlar, önceki sohbetler sisteme yüklenir
2. **Vektörleştirme**: Metinler embedding'lere dönüştürülür (OpenAI Ada / Sentence Transformers)
3. **Saklama**: Vector Database'de (FAISS/Pinecone) saklanır
4. **Sorgulama**: Kullanıcı sorusu geldiğinde en alakalı bilgiler bulunur
5. **Yanıt Üretimi**: LLM, bulunan bilgileri kullanarak doğal bir cevap üretir

### RAG Akış Örneği

```
Kullanıcı: "İade süresi kaç gün?"
    ↓
Embedding Oluştur
    ↓
Vector DB'de Ara
    ↓
Bulunan: "İade süresi 14 gündür"
    ↓
LLM Prompt: "Kullanıcı iade süresi soruyor. Bilgi: İade süresi 14 gün. Kibar yanıt ver."
    ↓
AI Yanıtı: "İade süremiz 14 gündür. Bu süre içinde ücretsiz iade yapabilirsiniz 😊"
```

## 🔒 Güvenlik

- ✅ JWT tabanlı kimlik doğrulama
- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ Input sanitization
- ✅ XSS & CSRF koruması
- ✅ HTTPS/WSS zorunlu (production)
- ✅ KVKK uyumlu veri saklama

## 📊 Veritabanı Şeması

### Ana Tablolar
- `users` - Admin/Agent kullanıcılar
- `sites` - Kayıtlı web siteleri
- `widgets` - Site başına widget konfigürasyonu
- `visitors` - Ziyaretçiler
- `conversations` - Sohbet oturumları
- `messages` - Mesajlar
- `knowledge_base` - RAG bilgi tabanı

## 🧪 Test

```bash
# Backend testleri
cd backend
npm test

# Frontend testleri
cd frontend/dashboard
npm test
```

## 📝 API Dokümantasyonu

API dokümantasyonu için: [docs/api-spec.md](docs/api-spec.md)

## 🤝 Katkıda Bulunma

Bu proje bir bitirme projesidir. Önerileriniz için issue açabilirsiniz.

## 📄 Lisans

MIT License

## 👨‍💻 Geliştirici

Bitirme Projesi - 2024/2025

---

**Not**: Bu proje aktif geliştirme aşamasındadır. MVP özellikleri tamamlandıkça güncellenecektir.


