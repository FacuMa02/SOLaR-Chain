# 🌿 Sistema de Trazabilidad Almazara 4.0 - Blockchain & IoT

Este proyecto es una plataforma de trazabilidad para la industria del aceite de oliva, utilizando Blockchain (Ethereum/Hardhat) para garantizar la inmutabilidad de los datos y SQLite para la gestión operativa y de auditoría.

## 🛠️ Requisitos Previos

Node.js (v18 o superior)

Git

Hardhat (incluido en las dependencias del proyecto)

## 🚀 Configuración del Entorno

1. Clonar y Preparar el Repositorio
   Primero, descargá el código en tu computadora e ingresá a la carpeta del proyecto:

Bash

```
git clone <tu-url-de-repositorio>
cd almazara-thesis 2. Infraestructura Blockchain (Hardhat)
```

Necesitamos levantar nuestra propia red blockchain local para pruebas. Abrí una terminal nueva y ejecutá:

Bash

```
npm install
npx hardhat node
```

Dejá esa terminal corriendo. Abrí otra terminal nueva para desplegar el Smart Contract en esa red que acabamos de crear:

Bash

```
npx hardhat ignition deploy ./ignition/modules/AlmazaraModule.js --network localhost
```

| Importante: Al finalizar, la terminal te va a mostrar una dirección (Contract Address) que empieza con 0x. Copiala, la vas a necesitar en el siguiente paso.

3. Configuración del Backend
   Ahora vamos a levantar la API y las bases de datos. Navegá a la carpeta del backend y prepará el entorno:

Bash

```
cd backend
npm install
cp .env.example .env
```

Abrí el archivo .env nuevo que se generó y pegá ahí la dirección del contrato que copiaste en el paso anterior, junto con tu clave privada.

Finalmente, encendé el servidor (esto también creará las bases de datos SQLite automáticamente):

```
node src/app.js
```

## 💾 Gestión de Datos (Arquitectura Híbrida)

El sistema utiliza tres capas de persistencia para garantizar seguridad y alto rendimiento en un entorno industrial:

Blockchain (Smart Contract): Almacena el estado actual del lote, las validaciones químicas estrictas y los hashes de integridad.

database.sqlite (Operativa): Gestiona el inventario de la tolva y los datos de los lotes para permitir búsquedas y lecturas rápidas desde el Frontend.

history.sqlite (Auditoría): Funciona como una bitácora inmutable (Audit Log) de todos los eventos y transiciones capturados directamente desde los eventos de la blockchain.

## 🔌 Endpoints Principales de la API

Gestión de Lotes (/api/lotes)
POST /abastecer-tolva: Carga kilos de aceituna en el inventario local.

POST /crear: Registra un lote en SQLite, genera su hash de integridad y lo ancla criptográficamente en la Blockchain.

POST /avanzar-etapa: Ejecuta la lógica de negocio en el Smart Contract y guarda el evento de resultado en la bitácora de auditoría.

POST /cancelar: Actúa como "botón de pánico" para anular permanentemente un lote con errores.

GET /consultar/:codigoLote: Obtiene los datos oficiales y el estado del lote directamente desde la Blockchain.

GET /auditar/:idSqlite: Compara el hash local de la base de datos contra el hash inmutable de la blockchain para detectar alteraciones o fraudes.

GET /historial/:idLoteBlockchain: Recupera la línea de tiempo completa del lote para dibujarla en el tablero del Frontend.

## 🧪 Guía de Pruebas y Auditoría

Para verificar la integridad del sistema frente a un jurado, podés seguir este flujo de demostración de fraude:

Crear un Lote: Abastecé la tolva y creá un lote nuevo.

Auditar: Consultá el endpoint de auditoría (/auditar/1); el estado que devuelve el sistema debe ser INTEGRO.

Simular Hackeo: Abrí el archivo database.sqlite con un gestor de bases de datos, modificá maliciosamente el peso o la variedad de ese lote y guardá los cambios.

Comprobar: Volvé a consultar el endpoint de auditoría. El sistema recalculará el hash local, detectará la discrepancia con la Blockchain y marcará el lote automáticamente como CORROMPIDO.

¿Te queda cómodo este formato para llevarlo a tu repositorio? Si querés, el próximo paso que podemos hacer es dejar armado el archivo .env.example con las variables vacías para que quede todo el entorno documentado a la perfección.
