# Pasos para configurar aplicación Solar-Chain

Dentro de cada carpeta, antes de todo: npm i

### Dentro de la carpeta solar-chain-hardhatv2

- ganache --wallet.deterministic --database.dbPath ./blockchain_db

- npx hardhat ignition deploy ./ignition/modules/LoteModule.ts --network localhost

###

### Dentro de la carpeta backend

- npx nodemon src/app.js
