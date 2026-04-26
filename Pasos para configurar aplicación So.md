# 🌿 Guía de Inicialización: Sistema de Trazabilidad Almazara 4.0 - Blockchain & IoT

El presente documento detalla el procedimiento oficial requerido para la configuración e inicialización de la plataforma de trazabilidad basada en tecnología Blockchain y bases de datos híbridas.

## 🛠️ Requisitos Previos

Para la correcta ejecución del sistema, es obligatoria la instalación previa del siguiente software en el entorno de desarrollo:

- Node.js (v18 o superior)
- Git
- Ganache (Interfaz gráfica o CLI)
- Hardhat (Incluido dentro de las dependencias del proyecto)

---

## 🚀 Configuración del Entorno

### Paso 1: Clonación y Preparación del Repositorio

El código fuente debe ser descargado en el equipo local. Para ello, se debe abrir una terminal y ejecutar los siguientes comandos, los cuales clonarán el repositorio y permitirán el acceso al directorio principal:

```bash
git clone <url-del-repositorio>
cd SOLaR-Chain
```

### Paso 2: Inicialización de la Red Blockchain (Ganache)

La infraestructura blockchain local debe ser establecida y ejecutada utilizando Ganache.

1. La aplicación Ganache debe ser iniciada (ya sea mediante su interfaz de usuario o ejecutando `ganache-cli` en la terminal) para aprovisionar una red local de pruebas.

### Paso 3: Compilación y Despliegue del Smart Contract

Una vez que la red de Ganache se encuentre en ejecución, el contrato inteligente debe ser compilado y desplegado. En la terminal, se debe ejecutar el comando de despliegue, asegurando que la red configurada en Hardhat apunte a la instancia local (generalmente puerto 7545 o 8545):

1. Primero se navega al directorio 'solar-chain-hardhatv2':

```bash
cd solar-chain-hardhatv2
```

2. Posteriormente se ejecuta el comando:

```bash
npx hardhat ignition deploy ./ignition/modules/AlmazaraModule.js --network localhost
```

> **Importante:** Al finalizar el proceso, la consola mostrará una dirección de contrato (Contract Address) que inicia con el prefijo `0x`. Esta dirección debe ser copiada, ya que es un requerimiento indispensable para la configuración del servidor backend.

### Paso 4: Configuración e Inicialización del Backend

La configuración del Backend comienza copiando el archivo JSON del contrato que se generó al hacer el _deployment_ del paso anterior,el cual está en la carpeta `solar-chain-hardhatv2/ignition/deployments/chain-1337/artifacts/`. Es el archivo que **no** tiene la extensión .dbg. Este archivo se copia y se pega en `backend/src/abis/`.

La API y las capas de base de datos deben ser preparadas. Se debe navegar al directorio del backend, instalar sus respectivas dependencias y generar el archivo de variables de entorno a partir de la plantilla provista:

```bash
cd backend
npm install
cp .env.example .env
```

El archivo `.env` recién generado debe ser editado. En dicho archivo se debe ingresar la dirección del contrato obtenida en el Paso 3, así como una de las claves privadas proporcionadas por la red de Ganache.

Finalmente, el servidor debe ser inicializado. Esta acción ejecutará las migraciones y creará las bases de datos SQLite automáticamente:

```bash
node src/app.js
```

> **Importante**. Para pasar al siguiente paso, en el backend se debe ejecutar el endpoint /auth/init con los datos de la clave maestra y contraseña nuevas.

### Paso 5: Configuración e Inicialización del Frontend

Para preparar la interfaz de usuario, se debe abrir una nueva pestaña en la terminal y navegar al directorio correspondiente. Las dependencias de la interfaz deben ser instaladas y el servidor de desarrollo debe ser iniciado:

```bash
cd frontend
npm install
npm run dev
```

_(Nota: El comando de ejecución final puede variar a `npm start` dependiendo de la configuración del framework utilizado en el entorno frontend)._

---

## 💾 Gestión de Datos (Arquitectura Híbrida)

El sistema está diseñado empleando tres capas de persistencia para asegurar la inmutabilidad y el alto rendimiento en un entorno industrial:

- **Blockchain (Smart Contract):** Es utilizada para almacenar el estado actual del lote, las validaciones químicas de carácter estricto y los hashes de integridad.
- **database.sqlite (Operativa):** Es empleada para la gestión del inventario de la tolva y los datos generales de los lotes, lo cual optimiza la velocidad de lectura y búsqueda desde el Frontend.
- **history.sqlite (Auditoría):** Es implementada como una bitácora inmutable (Audit Log), registrando de manera permanente todos los eventos y transiciones capturados directamente desde la red blockchain.

---

## 🔌 Endpoints Principales de la API

**Gestión de Lotes (`/api/lotes`)**

- `POST /abastecer-tolva`: El inventario local es abastecido mediante el registro de kilogramos de aceituna.
- `POST /crear`: Un nuevo lote es registrado en la base de datos operativa, su hash de integridad es generado y posteriormente es anclado de forma criptográfica en la red Blockchain.
- `POST /avanzar-etapa`: La lógica de negocio es validada y ejecutada en el Smart Contract, y el evento resultante es almacenado en la bitácora de auditoría.
- `POST /cancelar`: Función crítica diseñada para la anulación permanente de un lote que presente inconsistencias.
- `GET /consultar/:codigoLote`: El estado oficial e inmutable del lote es consultado directamente desde la red Blockchain.
- `GET /auditar/:idSqlite`: El hash local de la base de datos es recalculado y comparado contra el hash de la blockchain para la detección automática de alteraciones o fraudes.
- `GET /historial/:idLoteBlockchain`: La trazabilidad y línea de tiempo completa del lote es recuperada para su representación gráfica en la interfaz.

---

## 🧪 Guía de Pruebas y Auditoría

Para la verificación y demostración de la integridad del sistema frente a un proceso de evaluación, se sugiere el siguiente protocolo de simulación de fraude:

1.  **Creación e Ingreso:** La tolva es abastecida y un nuevo lote es creado a través del sistema.
2.  **Auditoría Inicial:** El endpoint de auditoría (`/auditar/1`) es consultado. Como resultado, el estado retornado por el sistema debe certificar que la información se encuentra **ÍNTEGRA**.
3.  **Simulación de Vulnerabilidad:** Utilizando un gestor de bases de datos externo, el archivo `database.sqlite` es intervenido de forma manual, modificando parámetros sensibles del lote, tales como el peso o la variedad. Los cambios son guardados directamente en el archivo local.
4.  **Comprobación de Seguridad:** El endpoint de auditoría es consultado nuevamente. El sistema procederá a recalcular el hash local, detectará la inconsistencia frente a la huella criptográfica de la Blockchain y el lote será marcado de manera automática y permanente como **CORROMPIDO**.
