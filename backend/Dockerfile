FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm install --ignore-scripts

# App kaynak dosyaları
COPY . .

# Logs klasörü
RUN mkdir -p logs

EXPOSE 4000

CMD ["npm", "run", "dev"]


