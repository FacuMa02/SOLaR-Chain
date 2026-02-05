# 🫒 Trazabilidad Aceite de Oliva - Guía de Ejecución

Este documento detalla los comandos necesarios para levantar el entorno de desarrollo local con persistencia de datos (Ganache + SQLite).

## 📋 Pre-requisitos

Asegúrate de tener instaladas las dependencias globales (solo se hace una vez):

```bash
npm install -g ganache
```

## 🖥️ PASO 1: La Blockchain (Ganache)

_Inicia el nodo simulado guardando los datos en disco._

1. Abre una **Terminal** en la raíz del proyecto.
2. Ejecuta el nodo persistente:

```bash
ganache --wallet.deterministic --database.dbPath ./blockchain_db

```

> **⚠️ IMPORTANTE:** No cierres esta terminal. Si la cierras, la blockchain se detiene.
> Si es la primera vez, creará la carpeta `blockchain_db`.

---

## 🚀 PASO 2: Smart Contracts (Hardhat)

_Compila y despliega el contrato en la red local._

1. Abre una **Segunda Terminal**.
2. Ve a la carpeta de blockchain:

```bash
cd blockchain

```

3. Compila el contrato (para verificar errores y generar el ABI nuevo):

```bash
npx hardhat compile

```

4. Despliega usando Ignition a la red local (Ganache):

```bash
npx hardhat ignition deploy ./ignition/modules/LoteModule.ts --network localhost

```

### 🔄 Tarea Manual Post-Deploy (Puente al Backend)

Cada vez que hagas un deploy nuevo, debes actualizar el Backend:

1. **Copiar Dirección:** Copia la dirección del contrato que salió en la terminal (ej: `0x5FbDB...`) y pégala en `backend/.env` -> `CONTRACT_ADDRESS`.
2. **Copiar ABI:** Copia el archivo JSON generado:

- **Origen:** `blockchain/artifacts/contracts/Almazara.sol/Almazara.json`
- **Destino:** `backend/src/abis/Almazara.json` (Reemplazar archivo existente).

---

## ⚙️ PASO 3: Base de Datos y Backend

_Inicia la base de datos SQLite y el servidor API._

1. Abre una **Tercera Terminal**.
2. Ve a la carpeta del backend:

```bash
cd backend

```

3. **(Solo si borraste la DB o es la primera vez)** Inicializa la tabla SQLite:

```bash
node src/setup_db.js

```

4. Inicia el servidor:

```bash
node src/app.js

```

> El servidor debería decir: `🚀 Servidor corriendo... Conectado a Blockchain...`

---

## 🧪 Cómo Probar (Thunder Client / Postman)

### 1. Crear Lote (Ingreso a Planta)

**POST** `http://localhost:3000/crear-lote`

**Body (JSON):**

```json
{
  "remito": "R-2026-XYZ-001",
  "peso": 5000,
  "agricultor": "Finca Los Olivos",
  "descripcion": "Aceituna Picual - Cosecha temprana"
}
```

### 2. Avanzar Etapa (Ej: A Molienda)

**POST** `http://localhost:3000/avanzar-etapa`

**Body (JSON):**

```json
{
  "idLote": 1,
  "etapa": 1,
  "rendimiento": 0,
  "acidez": 0,
  "peroxidos": 0
}
```

_(Nota: Etapa 1 es Molienda. Los KPIs van en 0 porque Molienda no valida calidad)._

---

## 🆘 Solución de Problemas Comunes

- **Error: `Nonce too low**`: Ocurre si reiniciaste Ganache (borraste `blockchain_db`) pero no reiniciaste tu billetera en MetaMask o el contador de transacciones del Backend.
- _Solución:_ Borra la carpeta `blockchain_db` y vuelve a hacer deploy.

- **Error: `connect ECONNREFUSED 127.0.0.1:8545**`: Ganache no está corriendo.
- _Solución:_ Revisa el PASO 1.

- **Error: `call revert exception**`: Probablemente la dirección del contrato en el `.env` es vieja o incorrecta.
- _Solución:_ Revisa el "Paso Manual" del PASO 2.

```

```
