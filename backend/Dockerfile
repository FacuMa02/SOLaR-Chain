# Backend Dockerfile
FROM node:20-bookworm-slim

WORKDIR /app/backend

# Copiar package files
COPY backend/package*.json ./

# Instalar dependencias
RUN npm ci --omit=dev

# Copiar código fuente
COPY backend/src ./src
COPY backend/reset-auth.js ./

# Carpeta para persistir SQLite mediante volumen
RUN mkdir -p /app/backend/data

# Variable de entorno
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 3001

# Comando de inicio
CMD ["node", "src/app.js"]
