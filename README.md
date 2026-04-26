# SOLaR-Chain - Sistema de Trazabilidad para Almazara

## Quick Start con Docker

### Requisitos

- Docker Engine 20.10+
- Docker Compose 2.0+

### Iniciar la aplicación

```bash
# Clonar el repositorio
cd SOLaR-Chain

# Iniciar con Docker Compose
docker-compose up -d

# La aplicación estará disponible en:
# - Frontend: http://localhost
# - Backend API: http://localhost:3000/api
```

### Primera ejecución (First-Run Experience)

La primera vez que se ejecuta la aplicación, se mostrará automáticamente una pantalla de configuración inicial donde deberás ingresar:

1. **Clave Maestra**: Una contraseña segura para recuperación de acceso
   - Mínimo 8 caracteres
   - La guardarás en lugar seguro en caso de olvidar la contraseña
2. **Contraseña de Administrador**: La contraseña para acceder a la aplicación
   - Mínimo 8 caracteres
   - Usuario fijo: `admin`

Una vez completada la configuración inicial:

- Se creará la base de datos SQLite con los datos de autenticación
- Se guardará la bandera de inicialización
- Se redirigirá automáticamente al login
- Nunca volverá a pedir estos datos (a menos que se borre el volumen Docker)

### Parar la aplicación

```bash
docker-compose down
```

### Ver logs

```bash
# Todos los logs
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend
```

## Estructura del Proyecto

```
SOLaR-Chain/
├── backend/              # API Express + SQLite
│   ├── Dockerfile
│   ├── src/
│   ├── package.json
│   └── produccion.sqlite (volumen persistente)
├── frontend/             # React + Vite
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── src/
│   └── package.json
├── solar-chain-hardhatv2/  # Smart Contracts Solidity
├── docker-compose.yml    # Orquestación de servicios
└── .dockerignore
```

## Seguridad

### Volúmenes Persistentes

La aplicación usa volúmenes Docker para persistir datos:

- `solar_db_data`: Base de datos SQLite del backend
- `solar_blockchain_db`: Base de datos de blockchain

Estos volúmenes:

- Persisten entre reinicios de contenedores
- Se conservan incluso si se recrean los contenedores
- Se eliminan solo si ejecutas `docker-compose down -v`

### Variables de entorno

Las contraseñas están hasheadas con Argon2 antes de guardarse en la BD.

## Notas

- La aplicación funciona **completamente offline** en la red local
- No requiere conexión a internet
- Compatible con redes corporativas cerradas
- Ideal para instalación en máquinas locales/industriales

## Desarrollo Local (sin Docker)

Si prefieres desarrollar sin Docker:

```bash
# Backend
cd backend
npm install
npm start

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

## Troubleshooting

### "ERR_CONNECTION_REFUSED" en el frontend

Espera a que el backend esté listo. El docker-compose incluye healthchecks automáticos.

### Limpiar datos y empezar de cero

```bash
docker-compose down -v
docker-compose up -d
```

### Resetear contraseñas (sin Docker)

```bash
cd backend
node reset-auth.js "mi_clave_maestra" "nueva_contraseña"
```
