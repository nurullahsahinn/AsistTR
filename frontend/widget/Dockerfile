# Widget Dockerfile (Development)
FROM node:18-alpine

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm install --ignore-scripts

# Source files
COPY . .

EXPOSE 5173

# Development mode with Vite
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

