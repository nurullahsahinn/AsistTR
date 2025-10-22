FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm install --production

# App kaynak dosyaları
COPY . .

# Logs klasörü
RUN mkdir -p logs

EXPOSE 4000

CMD ["node", "app.js"]

