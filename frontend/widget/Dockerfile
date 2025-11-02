# Widget Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Paket dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Kaynak kodları kopyala
COPY . .

# Build
RUN npm run build

# Production image
FROM nginx:alpine

# Build dosyalarını kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

# Test sayfasını kopyala
COPY public/test-widget.html /usr/share/nginx/html/test-widget.html

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

