# Dockerfile para despliegue del contrato Almazara en Ganache
# Usa solo ethers (sin Hardhat completo) para reducir dependencias de 583 a ~10 paquetes
FROM node:20-bookworm-slim

WORKDIR /app/solar-chain-hardhatv2

# Solo necesitamos ethers para desplegar
RUN npm install ethers@6

# Copiar artefactos ya compilados (no hace falta recompilar en contenedor)
COPY solar-chain-hardhatv2/artifacts ./artifacts

# Copiar script de deploy standalone
COPY solar-chain-hardhatv2/scripts/deploy-standalone.cjs ./scripts/deploy-standalone.cjs

CMD ["node", "scripts/deploy-standalone.cjs"]
