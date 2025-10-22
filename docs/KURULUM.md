# 🚀 AsistTR Kurulum Rehberi

Bu döküman, AsistTR projesini yerel ortamınızda nasıl çalıştıracağınızı adım adım anlatır.

## 📋 Gereksinimler

### Zorunlu
- **Node.js** 18+ ([İndir](https://nodejs.org/))
- **PostgreSQL** 14+ ([İndir](https://www.postgresql.org/download/))
- **Redis** 7+ ([İndir](https://redis.io/download/))
- **Git** ([İndir](https://git-scm.com/))

### Opsiyonel (AI için)
- **Ollama** ([İndir](https://ollama.ai/)) - Yerel LLM için

## 🛠️ Adım 1: Proje Kurulumu

### 1.1 Projeyi Klonlayın

```bash
git clone https://github.com/kullanici/AsistTR.git
cd AsistTR
```

### 1.2 Environment Variables Ayarlayın

```bash
# .env dosyasını oluşturun
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```env
# Database
DATABASE_URL=postgresql://asistr_user:asistr_pass@localhost:5432/asistr_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secret (güçlü bir şifre girin!)
JWT_SECRET=super-gizli-jwt-anahtari-buraya-yazin

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

## 🗄️ Adım 2: Veritabanı Kurulumu

### 2.1 PostgreSQL Database Oluşturun

```bash
# PostgreSQL'e bağlanın
psql -U postgres

# Veritabanı ve kullanıcı oluşturun
CREATE DATABASE asistr_db;
CREATE USER asistr_user WITH PASSWORD 'asistr_pass';
GRANT ALL PRIVILEGES ON DATABASE asistr_db TO asistr_user;
\q
```

### 2.2 Tabloları Oluşturun (Migration)

```bash
cd backend
npm install
npm run migrate
```

## 🔧 Adım 3: Backend Kurulumu

```bash
cd backend

# Dependencies yükle
npm install

# Development modda başlat
npm run dev
```

Backend şimdi `http://localhost:4000` adresinde çalışıyor olmalı.

### Test Edin

```bash
curl http://localhost:4000/health
# Çıktı: {"status":"ok","timestamp":"...","service":"AsistTR Backend"}
```

## 💻 Adım 4: Dashboard (Frontend) Kurulumu

Yeni bir terminal açın:

```bash
cd frontend/dashboard

# Dependencies yükle
npm install

# Development modda başlat
npm run dev
```

Dashboard şimdi `http://localhost:3000` adresinde çalışıyor olmalı.

## 🎨 Adım 5: Widget Kurulumu (Opsiyonel)

Yeni bir terminal açın:

```bash
cd frontend/widget

# Dependencies yükle
npm install

# Development modda başlat
npm run dev

# Widget demo: http://localhost:5173
```

## 🤖 Adım 6: Ollama Kurulumu (AI için)

### 6.1 Ollama'yı Yükleyin

Windows:
```bash
# Ollama Windows installer'ı indirin ve kurun
# https://ollama.ai/download
```

Linux/Mac:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 6.2 Llama 3 Modelini İndirin

```bash
ollama pull llama3
```

### 6.3 Ollama'yı Başlatın

```bash
ollama serve
```

Ollama şimdi `http://localhost:11434` adresinde çalışıyor olmalı.

### Test Edin

```bash
curl http://localhost:4000/api/rag/health
# Çıktı: {"status":"ok","message":"Ollama çalışıyor","model":"llama3"}
```

## 📦 Docker ile Kurulum (Alternatif)

Daha kolay kurulum için Docker kullanabilirsiniz:

```bash
# Tüm servisleri başlat
docker-compose up -d

# Logları görüntüle
docker-compose logs -f

# Durdur
docker-compose down
```

## ✅ İlk Kullanım

### 1. Admin Hesabı Oluşturun

- Dashboard'a gidin: http://localhost:3000
- "Kayıt Ol" butonuna tıklayın
- Bilgilerinizi girin ve hesap oluşturun

### 2. İlk Site'nizi Ekleyin

- Dashboard'da "Ayarlar" sayfasına gidin
- "Yeni Site Ekle" butonuna tıklayın
- Site adı ve domain girin
- Widget kodunu kopyalayın

### 3. Widget'ı Sitenize Ekleyin

Kopyaladığınız kodu web sitenizin `</body>` etiketinden önce yapıştırın:

```html
<script>
(function(){
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = 'http://localhost:5173/widget.js';
  s.setAttribute('data-api-key', 'API_KEY_BURAYA');
  var x = document.getElementsByTagName('script')[0];
  x.parentNode.insertBefore(s, x);
})();
</script>
```

### 4. Bilgi Tabanı Ekleyin (AI için)

- "Bilgi Tabanı" sayfasına gidin
- "Yeni Bilgi Ekle" butonuna tıklayın
- SSS veya ürün bilgilerini ekleyin
- AI artık bu bilgileri kullanarak yanıt verebilecek!

## 🐛 Sorun Giderme

### PostgreSQL Bağlantı Hatası

```bash
# PostgreSQL'in çalıştığını kontrol edin
pg_isready

# Çalışmıyorsa başlatın (Ubuntu/Debian)
sudo systemctl start postgresql

# Çalışmıyorsa başlatın (macOS)
brew services start postgresql
```

### Redis Bağlantı Hatası

```bash
# Redis'in çalıştığını kontrol edin
redis-cli ping
# Çıktı: PONG

# Çalışmıyorsa başlatın (Ubuntu/Debian)
sudo systemctl start redis

# Çalışmıyorsa başlatın (macOS)
brew services start redis
```

### Port Zaten Kullanılıyor

```bash
# 4000 portunu kullanan process'i bulun
# Windows
netstat -ano | findstr :4000

# Linux/Mac
lsof -i :4000

# Process'i sonlandırın veya .env'de PORT değiştirin
```

### Ollama Modeli Bulunamıyor

```bash
# Mevcut modelleri listeleyin
ollama list

# Llama 3'ü indirin
ollama pull llama3
```

## 📚 Sonraki Adımlar

- [API Dokümantasyonu](./API.md)
- [Mimari Dokümantasyon](./ARCHITECTURE.md)
- [Deployment Rehberi](./DEPLOYMENT.md)
- [FAQ](./FAQ.md)

## 💡 İpuçları

1. **Development**: `npm run dev` kullanın, otomatik yenileme için
2. **Production**: `npm start` kullanın
3. **Testler**: `npm test` ile testleri çalıştırın
4. **Loglama**: `backend/logs/` klasöründe loglar saklanır

## 🆘 Yardım

Sorun yaşıyorsanız:
- [GitHub Issues](https://github.com/kullanici/AsistTR/issues)
- Discord: [AsistTR Community](#)
- Email: destek@asistr.com

---

**Tebrikler! 🎉 AsistTR başarıyla kuruldu!**

