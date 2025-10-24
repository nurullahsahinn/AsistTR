# ❓ Sıkça Sorulan Sorular (FAQ)

## Genel Sorular

### AsistTR nedir?
AsistTR, Tawk.to benzeri yerli ve milli bir canlı destek platformudur. Web sitelerine gömülebilen widget ile ziyaretçilerle gerçek zamanlı iletişim kurmanızı ve RAG teknolojisi ile AI destekli otomatik yanıtlar vermenizi sağlar.

### Ücretsiz mi?
Evet! AsistTR açık kaynak kodludur ve tamamen ücretsizdir. MIT lisansı altında kullanabilirsiniz.

### Hangi dilleri destekliyor?
Şu anda Türkçe desteklenmektedir. Çok dilli destek gelecek versiyonlarda eklenecektir.

---

## Kurulum

### Minimum sistem gereksinimleri nelerdir?
- **CPU**: 2 core
- **RAM**: 4GB (Ollama kullanıyorsanız 8GB önerilir)
- **Disk**: 10GB boş alan
- **OS**: Windows, Linux, macOS

### Docker olmadan çalıştırabilir miyim?
Evet! Docker opsiyoneldir. Node.js, PostgreSQL ve Redis manuel kurulum ile de çalıştırabilirsiniz.

### Ollama olmadan çalışır mı?
Evet, ama AI özellikleri çalışmaz. Ollama olmadan sadece canlı destek olarak kullanabilirsiniz.

### PostgreSQL yerine MySQL kullanabilir miyim?
Hayır, şu anda sadece PostgreSQL desteklenmektedir. MySQL desteği gelecekte eklenebilir.

---

## Widget

### Widget'ı nasıl eklerim?
1. Dashboard'da "Ayarlar" sayfasına gidin
2. "Yeni Site Ekle" ile sitenizi kaydedin
3. Oluşturulan widget kodunu kopyalayın
4. Web sitenizin `</body>` etiketi öncesine yapıştırın

### Widget mobil uyumlu mu?
Evet! Widget responsive tasarıma sahiptir ve tüm cihazlarda çalışır.

### Widget'ın görünümünü özelleştirebilir miyim?
Şu anda temel ayarlar mevcuttur. Gelecek versiyonlarda tam tema özelleştirmesi eklenecektir.

### Widget sitemi yavaşlatır mı?
Hayır! Widget async olarak yüklenir ve sitenizin performansını etkilemez (~50KB).

---

## Mesajlaşma

### Gerçek zamanlı mı?
Evet! WebSocket (Socket.IO) kullanarak gerçek zamanlı mesajlaşma sağlanır.

### Mesaj geçmişi saklanır mı?
Evet, tüm mesajlar PostgreSQL veritabanında saklanır.

### Dosya gönderilebilir mi?
Şu anda desteklenmemektedir. Gelecek versiyonlarda eklenecektir.

### Kaç agent aynı anda çalışabilir?
Sınır yoktur! İstediğiniz kadar agent ekleyebilirsiniz.

---

## AI / RAG

### RAG nedir?
RAG (Retrieval-Augmented Generation), AI'ın bilgi tabanınızdan ilgili bilgileri bulup kullanarak daha doğru yanıtlar vermesini sağlar.

### Ollama kurulumu zor mu?
Hayır, çok basit:
```bash
# İndirin
curl -fsSL https://ollama.ai/install.sh | sh

# Model indirin
ollama pull llama3

# Başlatın
ollama serve
```

### OpenAI kullanabilir miyim?
Kod yapısı bunu destekler. `src/rag/ollama.service.js` dosyasını değiştirerek OpenAI API kullanabilirsiniz.

### AI yanıtları ne kadar doğru?
Doğruluk, bilgi tabanınızın kalitesine bağlıdır. Daha fazla ve kaliteli bilgi = daha iyi yanıtlar.

### AI yanlış yanıt verirse ne olur?
Agent, AI önerisini görebilir ve düzenleyebilir veya kendi yanıtını yazabilir. AI sadece öneri sunar.

---

## Güvenlik

### Veriler güvende mi?
Evet! Tüm şifreler bcrypt ile hashlenmiş, API JWT ile korunmuş ve HTTPS kullanımı zorunludur (production).

### KVKK uyumlu mu?
Evet, veriler kendi sunucunuzda saklanır. KVKK uyumluluk için açık rıza metinleri ekleyebilirsiniz.

### Rate limiting var mı?
Evet:
- Auth: 5 istek/15 dakika
- API: 100 istek/15 dakika
- Widget: 20 istek/dakika

---

## Performans

### Kaç konuşmayı destekler?
Test edilmemiş ama PostgreSQL ve Node.js ile binlerce eş zamanlı konuşma desteklenebilir.

### Yavaşlama yaşarsam ne yapmalıyım?
1. PostgreSQL indexleri kontrol edin
2. Redis cache kullanın
3. Horizontal scaling (load balancer)

### Database ne kadar büyür?
Yaklaşık 1KB/mesaj. 1 milyon mesaj ~1GB.

---

## Deployment

### Nereye deploy edebilirim?
- **Cloud**: AWS, Azure, DigitalOcean, Linode
- **VPS**: Herhangi bir Linux sunucu
- **Managed**: Heroku, Railway, Render
- **On-premise**: Kendi sunucunuz

### SSL sertifikası gerekli mi?
Production için kesinlikle! Let's Encrypt ile ücretsiz SSL alabilirsiniz.

### Domain gerekli mi?
Development için gerekli değil. Production için domain önerilir.

---

## Sorun Giderme

### "Port already in use" hatası
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID PID_NUMARASI /F

# Linux/Mac
lsof -i :4000
kill -9 PID_NUMARASI
```

### "Database connection failed"
```bash
# PostgreSQL çalışıyor mu?
pg_isready

# Çalışmıyorsa başlat
sudo systemctl start postgresql
```

### "Redis connection error"
```bash
# Redis çalışıyor mu?
redis-cli ping  # Çıktı: PONG

# Çalışmıyorsa başlat
sudo systemctl start redis
```

### Widget yüklenmiyor
1. API key doğru mu kontrol edin
2. CORS ayarlarını kontrol edin
3. Browser console'da hata var mı bakın
4. Network tab'de 404/CORS hatası var mı kontrol edin

### Ollama "model not found"
```bash
# Modeli indirin
ollama pull llama3

# Mevcut modelleri listeleyin
ollama list
```

### Socket bağlantısı kopuyor
1. Firewall ayarlarını kontrol edin
2. WebSocket portları açık mı kontrol edin
3. Proxy arkasındaysanız WebSocket support var mı bakın

---

## Geliştirme

### Katkıda bulunabilir miyim?
Evet! Pull request'ler kabul edilir. Önce issue açmanızı öneririz.

### Hangi teknolojileri kullanıyor?
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL, Redis
- **AI**: Ollama (Llama 3)

### Local development nasıl yapılır?
```bash
# Backend
cd backend
npm run dev

# Dashboard
cd frontend/dashboard
npm run dev

# Widget
cd frontend/widget
npm run dev
```

### Test nasıl yazılır?
Jest kullanılıyor:
```bash
npm test
```

---

## Lisans & Destek

### Lisans nedir?
MIT License - Ticari kullanım dahil tamamen ücretsiz!

### Destek alabilir miyim?
- GitHub Issues: Hata raporları
- Dokümantasyon: Bu klasör
- Email: destek@asistr.com (varsa)

### Ücretli destek var mı?
Şu anda yok, ama ileride kurulum/özelleştirme hizmetleri verilebilir.

---

## Diğer

### Tawk.to'dan farkı nedir?
- ✅ Açık kaynak
- ✅ Kendi sunucunuzda
- ✅ Veri size ait
- ✅ Yerli ve milli
- ✅ AI/RAG desteği (Ollama)
- ❌ Henüz mobil app yok
- ❌ Henüz video call yok

### Ticari projede kullanabilir miyim?
Evet! MIT lisansı ticari kullanıma izin verir.

### Logo/branding değiştirebilir miyim?
Evet, tamamen özelleştirebilirsiniz.

---

Başka sorunuz mu var? GitHub'da issue açın veya dokümantasyonu kontrol edin! 🚀


