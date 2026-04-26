import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const workspaceRoot = path.resolve(backendRoot, "..");
const hardhatRoot = path.resolve(workspaceRoot, "solar-chain-hardhatv2");

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveContractArtifact() {
    const hardhatArtifactPath = path.resolve(hardhatRoot, "artifacts", "contracts", "Almazara.sol", "Almazara.json");
    const backendArtifactPath = path.resolve(backendRoot, "src", "abis", "Almazara.json");

    return (
        readJsonIfExists(hardhatArtifactPath)
        || readJsonIfExists(backendArtifactPath)
    );
}

function resolveContractAddress() {
    if (process.env.CONTRACT_ADDRESS) {
        return process.env.CONTRACT_ADDRESS;
    }

    const deployedAddressesPath = path.resolve(hardhatRoot, "ignition", "deployments", "chain-1337", "deployed_addresses.json");
    const deployedAddresses = readJsonIfExists(deployedAddressesPath);

    return deployedAddresses?.["AlmazaraModule#Almazara"] || null;
}

const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
const privateKey = process.env.PRIVATE_KEY;
const contractArtifact = resolveContractArtifact();
const contractAddress = resolveContractAddress();

if (!contractArtifact?.abi) {
    throw new Error("No se encontró el ABI de Almazara. Compilá el contrato o verificá backend/src/abis/Almazara.json.");
}

if (!privateKey) {
    throw new Error("Falta PRIVATE_KEY en backend/.env para firmar transacciones en Ganache.");
}

if (!contractAddress) {
    throw new Error("No se encontró CONTRACT_ADDRESS. Definilo en backend/.env o desplegá con Hardhat Ignition en chain-1337.");
}

export const provider = new ethers.JsonRpcProvider(rpcUrl);
export const wallet = new ethers.Wallet(privateKey, provider);
export const contract = new ethers.Contract(contractAddress, contractArtifact.abi, wallet);
export const CONTRACT_ADDRESS = contractAddress;

export const ETAPAS = ["RECEPCION", "MOLIENDA", "BATIDO", "CENTRIFUGADO", "DECANTACION", "ANALISIS", "ALMACENAMIENTO"];
export const RESULTADOS = ["APROBADO", "OBSERVADO", "NO_CONFORME", "CANCELADO"];

console.log(`Conectado a RPC: ${rpcUrl}`);
console.log(`Conectado al contrato en: ${CONTRACT_ADDRESS}`);

export async function assertBlockchainReady() {
    const [network, code, nonce, balance] = await Promise.all([
        provider.getNetwork(),
        provider.getCode(CONTRACT_ADDRESS),
        provider.getTransactionCount(wallet.address),
        provider.getBalance(wallet.address),
    ]);

    if (!code || code === "0x") {
        throw new Error(`No hay bytecode desplegado en ${CONTRACT_ADDRESS}. Verificá Ganache y la dirección del contrato.`);
    }

    console.log(`Blockchain lista. ChainId=${network.chainId.toString()} Wallet=${wallet.address} Nonce=${nonce} Balance=${ethers.formatEther(balance)} ETH`);
}

export function parseReceiptEvent(receipt, eventNames) {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];

    for (const log of receipt?.logs || []) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && names.includes(parsed.name)) {
                return parsed;
            }
        } catch {
            // Ignorar logs ajenos al contrato
        }
    }

    return null;
}

export async function createLoteOnChain(hashIntegridad, variedad, pesoKg) {
    const tx = await contract.crearLote(hashIntegridad, variedad, pesoKg, { gasLimit: 500000 });
    const receipt = await tx.wait();
    const loteCreadoEvent = parseReceiptEvent(receipt, "LoteCreado");

    if (!loteCreadoEvent) {
        throw new Error("No se encontró el evento LoteCreado en la transacción confirmada.");
    }

    return {
        txHash: tx.hash,
        receipt,
        blockchainId: Number(loteCreadoEvent.args[0]),
        event: loteCreadoEvent,
    };
}

export async function advanceLoteOnChain(idLoteBlockchain, etapa, kgAceiteNeto, acidez, peroxidos) {
    await contract.avanzarEtapa.staticCall(
        idLoteBlockchain,
        etapa,
        Number(kgAceiteNeto) || 0,
        Number(acidez) || 0,
        Number(peroxidos) || 0
    );

    const tx = await contract.avanzarEtapa(
        idLoteBlockchain,
        etapa,
        Number(kgAceiteNeto) || 0,
        Number(acidez) || 0,
        Number(peroxidos) || 0,
        { gasLimit: 500000 }
    );

    const receipt = await tx.wait();
    const avanceEvent = parseReceiptEvent(receipt, "AvanceEtapa");

    return {
        txHash: tx.hash,
        receipt,
        event: avanceEvent,
    };
}

export async function cancelLoteOnChain(idLoteBlockchain, motivo) {
    const tx = await contract.cancelarLote(idLoteBlockchain, motivo, { gasLimit: 500000 });
    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        receipt,
        event: parseReceiptEvent(receipt, "LoteCancelado"),
    };
}

export async function registerInvalidTransitionOnChain(idLoteBlockchain, etapaSolicitada, motivo) {
    const tx = await contract.registrarTransicionInvalida(idLoteBlockchain, etapaSolicitada, motivo, { gasLimit: 500000 });
    const receipt = await tx.wait();

    return {
        txHash: tx.hash,
        receipt,
        event: parseReceiptEvent(receipt, "TransicionInvalidaRegistrada"),
    };
}

export async function getLoteOnChain(idLoteBlockchain) {
    return contract.getLote(idLoteBlockchain);
}


// Traductor de errores (Toma los errores de blockchain y los interpreta en el Backend)

// Traductor de errores unificado (Versión Robusta)
export function parseBlockchainError(error) {
    // 1. Buscar la huella digital del error en diferentes capas del objeto Ethers
    const errorData = error.data || (error.info && error.info.error && error.info.error.data) || (error.error && error.error.data);

    // 2. Prioridad MÁXIMA: Intentar decodificar Custom Errors de Solidity
    if (errorData) {
        try {
            const decoded = contract.interface.parseError(errorData);

            if (decoded?.name === 'TransicionInvalida') {
                return `Transición Inválida: No puedes saltar de ${ETAPAS[Number(decoded.args[0])]} a ${ETAPAS[Number(decoded.args[1])]}.`;
            }
            if (decoded?.name === 'PesoTolvaInsuficiente') {
                return `La tolva no tiene suficiente stock. Kilos disponibles: ${decoded.args[0]}, Solicitados: ${decoded.args[1]}.`;
            }
            if (decoded?.name === 'LoteNoExiste') {
                return `El lote on-chain con id ${decoded.args[0]} no existe.`;
            }
            if (decoded?.name === 'NoAutorizado') {
                return "La cuenta configurada en backend no está autorizada para ejecutar esta operación en el contrato.";
            }
            if (decoded?.name === 'LoteBloqueadoPorCancelacion') {
                return "Operación denegada: Este lote fue cancelado permanentemente y no puede continuar en la línea de producción.";
            }
        } catch (e) {
            // Si falla el parseo, lo ignoramos y seguimos bajando
        }
    }

    // 3. Prioridad MEDIA: Reverts de texto clásico (los require("Mensaje"))
    if (error.reason && error.reason !== "transaction execution reverted") {
        return error.reason;
    }

    const nestedMessage = error?.info?.error?.message || error?.error?.message || error?.message;
    if (nestedMessage) {
        const revertPrefix = "execution reverted: ";
        if (nestedMessage.includes(revertPrefix)) {
            return nestedMessage.split(revertPrefix).pop().trim();
        }
        return nestedMessage;
    }

    // 4. Prioridad BAJA: Mensajes genéricos de Ethers (Solo si todo lo demás falla)
    if (error.shortMessage) return error.shortMessage;

    return "Error desconocido en la validación del Smart Contract.";
}