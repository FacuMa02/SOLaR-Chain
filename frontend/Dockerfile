# Frontend Dockerfile (Multi-stage build)
FROM node:20-bookworm-slim AS builder

WORKDIR /app/frontend

# Copiar package files
COPY frontend/package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del proyecto frontend
COPY frontend/ ./

# Compilar la aplicación
ENV VITE_API_BASE=http://localhost:3001/api
RUN npm run build

# Stage 2: Servir la aplicación compilada
FROM nginx:alpine

# Copiar configuración de nginx
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos compilados desde builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Exponer puerto
EXPOSE 80

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
