import express from "express";
import { ethers } from "ethers";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

// --- CONFIGURACIÓN ---
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- CONSTANTES ---
const ETAPAS = ["RECEPCION", "MOLIENDA", "BATIDO", "CENTRIFUGADO", "DECANTACION", "ANALISIS", "ALMACENAMIENTO"];
const RESULTADOS = ["APROBADO", "OBSERVADO", "NO_CONFORME"];

// --- CONEXIÓN BLOCKCHAIN ---
// Asegúrate que tu nodo (Ganache/Hardhat) esté corriendo en el puerto correcto
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Cargar ABI
const jsonPath = "./src/abis/Almazara.json";
const contractJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

console.log(`🔗 Conectado al contrato en: ${process.env.CONTRACT_ADDRESS}`);

// ==========================================
// 🛠️ HELPER: TRADUCTOR DE ERRORES
// ==========================================
function parseBlockchainError(error) {
    // Si el error viene de un REVERT simple (require/revert string)
    if (error.reason) return error.reason;
    if (error.shortMessage) return error.shortMessage;

    // Si es un Custom Error (TransicionInvalida, etc)
    if (error.data) {
        try {
            const decoded = contract.interface.parseError(error.data);
            if (decoded?.name === 'TransicionInvalida') {
                const actual = Number(decoded.args[0]);
                const solicitada = Number(decoded.args[1]);
                return `Transición Inválida: No puedes saltar de ${ETAPAS[actual]} a ${ETAPAS[solicitada]}.`;
            }
        } catch (e) { /* Ignorar fallo de parseo */ }
    }
    return "Error en validación del Smart Contract.";
}

// ==========================================
// 🚀 ENDPOINT 1: CREAR LOTE
// ==========================================
app.post("/crear-lote", async (req, res) => {
    const { remito } = req.body;

    try {
        // Como no hay DB, generamos un ID temporal o usamos el remito como ID externo
        const idTemporal = "TEMP-" + Date.now();

        console.log(`📝 Creando lote Remito: ${remito}...`);

        const tx = await contract.crearLote(remito, idTemporal, { gasLimit: 500000 });
        const receipt = await tx.wait();

        // Buscamos el ID real de Blockchain en el evento
        const eventLog = receipt.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === 'LoteCreado'; }
            catch { return false; }
        });
        const parsedLog = contract.interface.parseLog(eventLog);
        const blockchainId = parsedLog.args[0].toString();

        res.json({
            success: true,
            message: "Lote creado en Blockchain exitosamente.",
            data: {
                idBlockchain: blockchainId,
                remito,
                txHash: tx.hash
            }
        });

    } catch (error) {
        console.error("❌ Error Crear Lote:", error);
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});

// ==========================================
// 🔄 ENDPOINT 2: AVANZAR ETAPA
// ==========================================
app.post("/avanzar-etapa", async (req, res) => {
    // OJO: Ahora el frontend debe mandar el ID DE BLOCKCHAIN (ej: 1, 2, 3...)
    const { idLoteBlockchain, etapa, rendimiento, acidez, peroxidos } = req.body;

    try {
        console.log(`⚙️ Avanzando Lote ID ${idLoteBlockchain} a etapa ${ETAPAS[etapa]}...`);

        const tx = await contract.avanzarEtapa(
            idLoteBlockchain,
            etapa,
            rendimiento || 0,
            acidez || 0,
            peroxidos || 0,
            { gasLimit: 500000 }
        );

        const receipt = await tx.wait();

        // Leer resultado del evento
        const eventLog = receipt.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === 'AvanceEtapa'; }
            catch { return false; }
        });
        const parsedLog = contract.interface.parseLog(eventLog);
        const resultadoCode = Number(parsedLog.args[2]);
        const motivo = parsedLog.args[3];

        res.json({
            success: true,
            txHash: tx.hash,
            resultado: RESULTADOS[resultadoCode],
            motivo: motivo,
            warning: resultadoCode > 0, // True si es Observado o No Conforme
            message: resultadoCode > 0
                ? `⚠️ Avanzado con observación: ${RESULTADOS[resultadoCode]} (${motivo})`
                : "✅ Lote avanzado correctamente."
        });

    } catch (error) {
        const mensaje = parseBlockchainError(error);
        // Si es un error de lógica (Revert), devolvemos 400 Bad Request
        res.status(400).json({ success: false, error: mensaje });
    }
});

// ==========================================
// 🔍 ENDPOINT 3: GET LOTE (CORREGIDO)
// ==========================================
app.get("/lote/:id", async (req, res) => {
    const id = req.params.id;

    try {
        // Llamada al contrato
        const lote = await contract.getLote(id);

        // Si llegamos aquí, el lote existe
        const data = {
            id: lote.id.toString(),
            remito: lote.numeroRemito,
            etapa: {
                id: Number(lote.etapaActual),
                nombre: ETAPAS[Number(lote.etapaActual)]
            },
            calidad: {
                estado: RESULTADOS[Number(lote.estadoCalidad)],
                observaciones: lote.observaciones
            },
            kpis: {
                rendimiento: Number(lote.kpis.rendimiento),
                acidez: Number(lote.kpis.acidez),
                peroxidos: Number(lote.kpis.peroxidos)
            },
            // Convertimos timestamp BigInt a fecha legible
            fecha: new Date(Number(lote.timestamp) * 1000).toLocaleString()
        };

        res.json({ success: true, data });

    } catch (error) {
        // --- AQUÍ ESTÁ LA MAGIA ---

        // 1. Detectar si el error es "CALL_EXCEPTION" (típico de Revert en llamadas de lectura)
        // O si el mensaje incluye el nombre de nuestro error personalizado
        if (error.code === 'CALL_EXCEPTION' || error.message.includes("LoteNoExiste")) {

            console.warn(`⚠️ Cliente solicitó Lote ID ${id} (No existe)`);

            // Devolvemos 404 explícito
            return res.status(404).json({
                success: false,
                error: "Lote no encontrado"
            });
        }

        // 2. Cualquier otro error real
        console.error("❌ Error GET Lote:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend (Solo Blockchain) corriendo en puerto ${PORT}`);
});