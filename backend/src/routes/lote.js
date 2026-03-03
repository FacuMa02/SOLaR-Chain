import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";
import { contract, parseBlockchainError, ETAPAS, RESULTADOS } from "../config/blockchain.js";

const router = express.Router();

//  ENDPOINT AUXILIAR: ABASTECER TOLVA en SQLite
router.post("/abastecer-tolva", async (req, res) => {
    const { kilos } = req.body;
    const db = getDB();

    try {
        const tolva = await db.get("SELECT peso_disponible FROM tolva WHERE id = 1");
        const nuevoPeso = tolva.peso_disponible + kilos;

        // Hash de integridad para la tolva
        const nuevoHash = crypto.createHash('sha256').update(`TOLVA-${nuevoPeso}`).digest('hex');

        await db.run(
            "UPDATE tolva SET peso_disponible = ?, hash_integridad = ? WHERE id = 1",
            [nuevoPeso, nuevoHash]
        );

        res.json({ success: true, message: `Tolva abastecida. Nuevo stock: ${nuevoPeso}kg`, hash: nuevoHash });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al abastecer tolva." });
    }
});

// --- ENDPOINT PRINCIPAL: CREAR LOTE ---
router.post("/crear-lote", async (req, res) => {
    const { codigoLote, fechaInicio, variedad, pesoKg } = req.body;
    const db = getDB();

    try {
        // VALIDACIÓN 1: Peso en Tolva 
        const tolva = await db.get("SELECT peso_disponible FROM tolva WHERE id = 1");
        if (tolva.peso_disponible < pesoKg) {
            return res.status(400).json({
                success: false,
                error: `No hay suficientes aceitunas. Disponible: ${tolva.peso_disponible}kg, Solicitado: ${pesoKg}kg.`
            });
        }

        // VALIDACIÓN 2: Insertar en BD (Chequeo de código de lote único) 
        let idSqlite;
        try {
            const result = await db.run(
                `INSERT INTO lotes (codigo_lote, fecha_inicio, variedad, peso_kg) VALUES (?, ?, ?, ?)`,
                [codigoLote, fechaInicio, variedad, pesoKg]
            );
            idSqlite = result.lastID;
        } catch (dbError) {
            // Capturamos el error de restricción UNIQUE de SQLite
            if (dbError.message.includes("UNIQUE constraint failed") || dbError.code === "SQLITE_CONSTRAINT") {
                return res.status(400).json({
                    success: false,
                    error: `El código de lote '${codigoLote}' ya existe. Debe ser único.`
                });
            }
            throw dbError;
        }

        // HASH Y BLOCKCHAIN 
        const dataToHash = `${idSqlite}-${codigoLote}-${fechaInicio}-${variedad}-${pesoKg}`;
        const hashIntegridad = crypto.createHash('sha256').update(dataToHash).digest('hex');

        const tx = await contract.crearLote(hashIntegridad, variedad, pesoKg, { gasLimit: 500000 });
        const receipt = await tx.wait();

        const eventLog = receipt.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === 'LoteCreado'; } catch { return false; }
        });
        const blockchainId = Number(contract.interface.parseLog(eventLog).args[0]);

        // --- ACTUALIZAR SQLite Y DESCONTAR TOLVA ---
        await db.run(
            `UPDATE lotes SET blockchain_id = ?, hash_integridad = ?, tx_creacion_hash = ? WHERE id = ?`,
            [blockchainId, hashIntegridad, tx.hash, idSqlite]
        );

        const nuevoPesoTolva = tolva.peso_disponible - pesoKg;
        const hashTolva = crypto.createHash('sha256').update(`TOLVA-${nuevoPesoTolva}`).digest('hex');
        await db.run("UPDATE tolva SET peso_disponible = ?, hash_integridad = ? WHERE id = 1", [nuevoPesoTolva, hashTolva]);

        res.json({ success: true, data: { idSqlite, blockchainId, hashIntegridad, stockRestante: nuevoPesoTolva } });

    } catch (error) {
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});

// ==========================================
// 3. OBTENER LOTE POR CÓDIGO (DB -> Smart Contract)
// ==========================================
router.get("/consultar/:codigoLote", async (req, res) => {
    const { codigoLote } = req.params;
    const db = getDB();

    try {
        // 1. Buscamos el ID de la blockchain usando el código como índice
        const loteDb = await db.get("SELECT blockchain_id FROM lotes WHERE codigo_lote = ?", [codigoLote]);

        if (!loteDb || !loteDb.blockchain_id) {
            return res.status(404).json({ success: false, error: `El lote '${codigoLote}' no existe o no está sincronizado.` });
        }

        // 2. Le pedimos la información real a la Blockchain
        const loteSC = await contract.getLote(loteDb.blockchain_id);

        res.json({
            success: true,
            data: {
                codigoLote: codigoLote,
                variedad: loteSC.variedad,
                pesoKg: Number(loteSC.pesoKg),
                etapaActual: ETAPAS[Number(loteSC.etapaActual)],
                estadoCalidad: RESULTADOS[Number(loteSC.estadoCalidad)],
                observaciones: loteSC.observaciones,
                hashIntegridad: loteSC.idBaseDatos
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});

// ==========================================
// 4. CANCELAR LOTE (Botón de pánico)
// ==========================================
router.post("/cancelar-lote", async (req, res) => {
    const { codigoLote, motivo } = req.body;
    const db = getDB();

    if (!codigoLote || !motivo) {
        return res.status(400).json({ success: false, error: "Se requiere codigoLote y motivo." });
    }

    try {
        const loteDb = await db.get("SELECT blockchain_id FROM lotes WHERE codigo_lote = ?", [codigoLote]);
        if (!loteDb) return res.status(404).json({ success: false, error: "Lote no encontrado." });

        const tx = await contract.cancelarLote(loteDb.blockchain_id, motivo, { gasLimit: 500000 });
        await tx.wait();

        res.json({ success: true, message: `Lote '${codigoLote}' cancelado permanentemente en la Blockchain.`, txHash: tx.hash });

    } catch (error) {
        res.status(400).json({ success: false, error: parseBlockchainError(error) });
    }
});

// --- ENDPOINT: AVANZAR ETAPA ---
router.post("/avanzar-etapa", async (req, res) => {
    const { idLoteBlockchain, etapa, rendimiento, acidez, peroxidos } = req.body;
    const db = getDB();
    try {
        const tx = await contract.avanzarEtapa(
            idLoteBlockchain, etapa, rendimiento || 0, acidez || 0, peroxidos || 0, { gasLimit: 500000 }
        );
        const receipt = await tx.wait();

        // Aquí podrías agregar el insert a la tabla historial_procesos si lo deseas

        res.json({ success: true, txHash: tx.hash, message: "Avanzó de etapa correctamente." });
    } catch (error) {
        res.status(400).json({ success: false, error: parseBlockchainError(error) });
    }
});

// ENDPOINT: AUDITAR INTEGRIDAD DE UN LOTE 
router.get("/auditar/:idSqlite", async (req, res) => {
    const { idSqlite } = req.params;
    const db = getDB();

    try {
        // 1. Obtener los datos actuales de SQLite
        const loteDB = await db.get(`SELECT * FROM lotes WHERE id = ?`, [idSqlite]);

        if (!loteDB) {
            return res.status(404).json({ success: false, error: "Lote no encontrado en la base de datos local." });
        }

        if (!loteDB.blockchain_id) {
            return res.status(400).json({ success: false, error: "Este lote aún no ha sido sincronizado con la Blockchain." });
        }

        // 2. Recalcular el Hash con los datos que TENEMOS AHORA en la base de datos
        // IMPORTANTE: Debe ser exactamente el mismo orden y formato que usamos al crear
        const dataToHash = `${loteDB.id}-${loteDB.codigo_lote}-${loteDB.fecha_inicio}-${loteDB.variedad}-${loteDB.peso_kg}`;
        const hashRecalculado = crypto.createHash('sha256').update(dataToHash).digest('hex');

        // 3. Consultar el Hash original inmutable en la Blockchain
        const loteBlockchain = await contract.getLote(loteDB.blockchain_id);
        const hashEnBlockchain = loteBlockchain.idBaseDatos; // Recuerda que guardamos el hash en este campo

        // 4. Comparación y Veredicto
        const esValido = hashRecalculado === hashEnBlockchain;

        res.json({
            success: true,
            auditoria: {
                estado: esValido ? "INTEGRO" : "CORROMPIDO",
                esValido: esValido,
                detalles: {
                    hashBlockchain: hashEnBlockchain,
                    hashLocalRecalculado: hashRecalculado
                }
            },
            mensaje: esValido
                ? "✅ Los datos son auténticos y no han sido alterados."
                : "❌ ALERTA DE SEGURIDAD: Los datos en la base de datos han sido modificados ilegalmente."
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Error al auditar: " + error.message });
    }
});

export default router;