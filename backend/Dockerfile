# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app/backend

# Copiar package files
COPY backend/package*.json ./

# Instalar dependencias
RUN npm ci --production

# Copiar código fuente
COPY backend/src ./src
COPY backend/reset-auth.js ./

# Variable de entorno
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/app.js"]
