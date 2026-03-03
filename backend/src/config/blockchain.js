import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Conexión Blockchain
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Cargar ABI del contrato
const jsonPath = "./src/abis/Almazara.json";
const contractJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

export const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

export const ETAPAS = ["RECEPCION", "MOLIENDA", "BATIDO", "CENTRIFUGADO", "DECANTACION", "ANALISIS", "ALMACENAMIENTO"];
export const RESULTADOS = ["APROBADO", "OBSERVADO", "NO_CONFORME", "CANCELADO"];

console.log(`🔗 Conectado al contrato en: ${process.env.CONTRACT_ADDRESS}`);


// Traductor de errores (Toma los errores de blockchain y los interpreta en el Backend)

export function parseBlockchainError(error) {
    if (error.reason) return error.reason;
    if (error.shortMessage) return error.shortMessage;

    if (error.data) {
        try {
            const decoded = contract.interface.parseError(error.data);
            if (decoded?.name === "TransicionInvalida") {
                const actual = Number(decoded.args[0]);
                const solicitada = Number(decoded.args[1]);
                return `Transición Inválida: No puedes saltar de ${ETAPAS[actual]} a ${ETAPAS[solicitada]}.`;
            }
        } catch (e) {
            /* Ignorar fallo de parseo */
        }
    }
    return "Error en validación del Smart Contract.";
}