import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Conexión Blockchain
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
export const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Cargar ABI del contrato
const jsonPath = "./src/abis/Almazara.json";
const contractJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

export const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

export const ETAPAS = ["RECEPCION", "MOLIENDA", "BATIDO", "CENTRIFUGADO", "DECANTACION", "ANALISIS", "ALMACENAMIENTO"];
export const RESULTADOS = ["APROBADO", "OBSERVADO", "NO_CONFORME", "CANCELADO"];

console.log(`🔗 Conectado al contrato en: ${process.env.CONTRACT_ADDRESS}`);


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

    // 4. Prioridad BAJA: Mensajes genéricos de Ethers (Solo si todo lo demás falla)
    if (error.shortMessage) return error.shortMessage;

    return "Error desconocido en la validación del Smart Contract.";
}