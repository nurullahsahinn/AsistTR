# 📡 AsistTR API Dokümantasyonu

## Base URL
```
http://localhost:4000/api
```

## Authentication

Çoğu endpoint JWT token gerektirir. Token'ı header'da gönderin:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔐 Authentication Endpoints

### POST /auth/register
Yeni kullanıcı kaydı

**Request Body:**
```json
{
  "name": "Ahmet Yılmaz",
  "email": "ahmet@example.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "message": "Kayıt başarılı",
  "user": {
    "id": "uuid",
    "name": "Ahmet Yılmaz",
    "email": "ahmet@example.com",
    "role": "agent"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Kullanıcı girişi

**Request Body:**
```json
{
  "email": "ahmet@example.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "message": "Giriş başarılı",
  "user": {
    "id": "uuid",
    "name": "Ahmet Yılmaz",
    "email": "ahmet@example.com",
    "role": "agent"
  },
  "token": "jwt_token_here"
}
```

### GET /auth/me
Kullanıcı bilgilerini getir (🔒 Auth gerekli)

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Ahmet Yılmaz",
    "email": "ahmet@example.com",
    "role": "agent",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 💬 Chat Endpoints

### GET /chat
Konuşmaları listele (🔒 Auth gerekli)

**Query Parameters:**
- `siteId` (optional): Site ID
- `status` (optional): open | closed

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "status": "open",
      "visitor_name": "Mehmet",
      "visitor_email": "mehmet@example.com",
      "site_name": "E-Ticaret",
      "last_message": "Merhaba, yardım istiyorum",
      "last_message_time": "2024-01-01T12:00:00.000Z",
      "created_at": "2024-01-01T11:00:00.000Z"
    }
  ]
}
```

### GET /chat/:conversationId/messages
Konuşma mesajlarını getir (🔒 Auth gerekli)

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "sender_type": "visitor",
      "body": "Merhaba",
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    {
      "id": 2,
      "sender_type": "agent",
      "body": "Merhaba, nasıl yardımcı olabilirim?",
      "created_at": "2024-01-01T12:01:00.000Z"
    }
  ]
}
```

### POST /chat/:conversationId/close
Konuşmayı kapat (🔒 Auth gerekli)

**Request Body:**
```json
{
  "rating": 5
}
```

**Response:**
```json
{
  "message": "Konuşma kapatıldı"
}
```

### POST /chat/:conversationId/assign
Agent ata (🔒 Auth gerekli)

**Request Body:**
```json
{
  "agentId": "agent_uuid"
}
```

**Response:**
```json
{
  "message": "Agent atandı"
}
```

---

## 🌐 Widget/Site Endpoints

### GET /widget/settings/:apiKey
Widget ayarlarını getir (Public)

**Response:**
```json
{
  "widget": {
    "id": "uuid",
    "settings": {
      "theme": "blue",
      "welcomeMessage": "Hoş geldiniz!"
    },
    "site_name": "E-Ticaret",
    "domain": "example.com"
  }
}
```

### GET /widget/sites
Siteleri listele (🔒 Auth gerekli)

**Response:**
```json
{
  "sites": [
    {
      "id": "uuid",
      "name": "E-Ticaret Sitem",
      "domain": "example.com",
      "api_key": "api_key_here",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /widget/sites
Yeni site oluştur (🔒 Auth gerekli)

**Request Body:**
```json
{
  "name": "E-Ticaret Sitem",
  "domain": "example.com",
  "settings": {
    "theme": "blue",
    "welcomeMessage": "Hoş geldiniz!"
  }
}
```

**Response:**
```json
{
  "message": "Site oluşturuldu",
  "site": {
    "id": "uuid",
    "name": "E-Ticaret Sitem",
    "domain": "example.com",
    "api_key": "generated_api_key",
    "settings": {}
  }
}
```

### PUT /widget/sites/:siteId/settings
Site ayarlarını güncelle (🔒 Auth gerekli)

**Request Body:**
```json
{
  "settings": {
    "theme": "green",
    "welcomeMessage": "Nasıl yardımcı olabiliriz?"
  }
}
```

**Response:**
```json
{
  "message": "Ayarlar güncellendi"
}
```

---

## 🧠 RAG (AI) Endpoints

### GET /rag/health
Ollama durumunu kontrol et (Public)

**Response:**
```json
{
  "status": "ok",
  "message": "Ollama çalışıyor",
  "url": "http://localhost:11434",
  "model": "llama3"
}
```

### GET /rag/knowledge
Bilgi tabanını listele (🔒 Auth gerekli)

**Query Parameters:**
- `siteId`: Site ID (required)

**Response:**
```json
{
  "knowledge": [
    {
      "id": "uuid",
      "title": "İade Politikası",
      "metadata": {
        "category": "policy"
      },
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /rag/knowledge/:id
Bilgi detayı getir (🔒 Auth gerekli)

**Response:**
```json
{
  "knowledge": {
    "id": "uuid",
    "title": "İade Politikası",
    "content": "İade süresi 14 gündür...",
    "metadata": {
      "category": "policy"
    },
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /rag/knowledge
Yeni bilgi ekle (🔒 Auth gerekli)

**Request Body:**
```json
{
  "siteId": "site_uuid",
  "title": "İade Politikası",
  "content": "İade süresi 14 gündür. Bu süre içinde ücretsiz iade yapabilirsiniz.",
  "metadata": {
    "category": "policy"
  }
}
```

**Response:**
```json
{
  "message": "Bilgi eklendi",
  "knowledge": {
    "id": "uuid",
    "title": "İade Politikası",
    "content": "..."
  }
}
```

### PUT /rag/knowledge/:id
Bilgiyi güncelle (🔒 Auth gerekli)

**Request Body:**
```json
{
  "title": "Güncellenmiş İade Politikası",
  "content": "Yeni iade süresi 30 gündür.",
  "isActive": true
}
```

**Response:**
```json
{
  "message": "Bilgi güncellendi",
  "knowledge": { ... }
}
```

### DELETE /rag/knowledge/:id
Bilgiyi sil (🔒 Auth gerekli)

**Response:**
```json
{
  "message": "Bilgi silindi"
}
```

### POST /rag/knowledge/bulk
Toplu bilgi ekle (🔒 Auth gerekli)

**Request Body:**
```json
{
  "siteId": "site_uuid",
  "items": [
    {
      "title": "SSS 1",
      "content": "Cevap 1",
      "metadata": { "category": "faq" }
    },
    {
      "title": "SSS 2",
      "content": "Cevap 2",
      "metadata": { "category": "faq" }
    }
  ]
}
```

**Response:**
```json
{
  "message": "2 bilgi eklendi",
  "knowledge": [ ... ]
}
```

### POST /rag/generate
AI yanıt üret (🔒 Auth gerekli)

**Request Body:**
```json
{
  "conversationId": "conversation_uuid",
  "message": "Kargo ne zaman gelir?"
}
```

**Response:**
```json
{
  "response": "Kargolar genellikle 2-3 iş günü içinde teslim edilir.",
  "sources": [
    {
      "id": "uuid",
      "title": "Kargo Bilgileri"
    }
  ],
  "hasKnowledge": true
}
```

### POST /rag/suggest
Agent için AI önerisi (🔒 Auth gerekli)

**Request Body:**
```json
{
  "conversationId": "conversation_uuid",
  "visitorMessage": "İade nasıl yapılır?"
}
```

**Response:**
```json
{
  "suggestion": "İade için ürünü orijinal ambalajında 14 gün içinde gönderebilirsiniz.",
  "confidence": "high",
  "sources": [
    {
      "id": "uuid",
      "title": "İade Politikası"
    }
  ]
}
```

---

## 📨 WebSocket Events

### Client → Server

#### visitor:connect
Ziyaretçi bağlantısı
```json
{
  "siteId": "site_uuid",
  "sessionId": "session_123",
  "visitorInfo": {
    "name": "Ahmet",
    "email": "ahmet@example.com"
  }
}
```

#### agent:connect
Agent bağlantısı
```json
{
  "agentId": "agent_uuid",
  "siteId": "site_uuid"
}
```

#### message:send
Mesaj gönder
```json
{
  "conversationId": "conversation_uuid",
  "body": "Merhaba!",
  "senderType": "visitor" // veya "agent"
}
```

#### typing:start
Yazıyor bildirimi başlat
```json
{
  "conversationId": "conversation_uuid"
}
```

#### typing:stop
Yazıyor bildirimi durdur
```json
{
  "conversationId": "conversation_uuid"
}
```

### Server → Client

#### visitor:connected
Ziyaretçi bağlandı
```json
{
  "conversationId": "conversation_uuid",
  "visitorId": "visitor_uuid"
}
```

#### agent:connected
Agent bağlandı
```json
{
  "agentId": "agent_uuid"
}
```

#### message:received
Mesaj alındı
```json
{
  "id": 123,
  "conversationId": "conversation_uuid",
  "senderType": "agent",
  "body": "Size nasıl yardımcı olabilirim?",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

#### conversation:new
Yeni konuşma
```json
{
  "conversationId": "conversation_uuid",
  "visitor": {
    "id": "visitor_uuid",
    "name": "Ahmet"
  }
}
```

#### typing:agent
Agent yazıyor

#### typing:stop
Yazma durdu

---

## ⚠️ Hata Kodları

| Kod | Açıklama |
|-----|----------|
| 400 | Bad Request - Geçersiz istek |
| 401 | Unauthorized - Token geçersiz veya yok |
| 403 | Forbidden - Yetkiniz yok |
| 404 | Not Found - Kaynak bulunamadı |
| 429 | Too Many Requests - Rate limit aşıldı |
| 500 | Internal Server Error - Sunucu hatası |

**Hata Response Formatı:**
```json
{
  "error": "Hata mesajı",
  "details": [] // Validasyon hataları için
}
```

---

## 🚀 Rate Limiting

- **Genel API**: 100 istek / 15 dakika
- **Auth Endpoints**: 5 istek / 15 dakika
- **Widget**: 20 istek / dakika

---

## 💡 Örnekler

### cURL ile Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

### JavaScript ile Mesaj Gönderme
```javascript
const response = await fetch('http://localhost:4000/api/chat/conv-id/messages', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
console.log(data.messages);
```


