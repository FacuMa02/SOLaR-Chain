import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";
import { getHistoryDB } from "../config/history_db.js";
import { contract, wallet, parseBlockchainError, ETAPAS, RESULTADOS } from "../config/blockchain.js";
import { buildExcelBuffer, sendExcelFile } from "../utils/excelExport.js";

const router = express.Router();

let soporteRegistroInvalidoOnChain = null;

async function registrarEventoHistorial({ blockchainId, tipoEvento, etapa, detalles, txHash = null, fecha = new Date().toISOString() }) {
    const historyDb = getHistoryDB();
    await historyDb.run(
        `INSERT INTO historial_eventos (blockchain_id, tipo_evento, etapa, detalles, tx_hash, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [blockchainId, tipoEvento, etapa, detalles, txHash, fecha]
    );
}

async function contratoSoportaRegistroInvalido() {
    if (soporteRegistroInvalidoOnChain !== null) {
        return soporteRegistroInvalidoOnChain;
    }

    const selector = contract.interface.getFunction("registrarTransicionInvalida").selector.slice(2).toLowerCase();
    const deployedCode = await wallet.provider.getCode(contract.target);

    soporteRegistroInvalidoOnChain = deployedCode.toLowerCase().includes(selector);
    return soporteRegistroInvalidoOnChain;
}

async function registrarIntentoInvalidoEnBlockchain(blockchainId, etapaSolicitada, motivo) {
    if (!await contratoSoportaRegistroInvalido()) {
        return null;
    }

    const tx = await contract.registrarTransicionInvalida(blockchainId, etapaSolicitada, motivo, { gasLimit: 500000 });
    await tx.wait();
    return tx.hash;
}

async function obtenerBlockchainIdPorSqlite(db, idSqlite) {
    const lote = await db.get("SELECT blockchain_id, codigo_lote FROM lotes WHERE id = ?", [idSqlite]);

    if (!lote) {
        return { error: "Lote no encontrado." };
    }

    if (!lote.blockchain_id) {
        return { error: `El lote '${lote.codigo_lote}' no está sincronizado con blockchain.` };
    }

    return { blockchainId: lote.blockchain_id };
}

async function obtenerHistorialUnificado(historyDb, idLoteBlockchain) {
    return historyDb.all(
        `
        SELECT 
            etapa,
            resultado,
            motivo,
            rendimiento,
            acidez,
            peroxidos,
            tx_hash,
            fecha_hora
        FROM transiciones 
        WHERE blockchain_id = ? 
        
        UNION ALL 
        
        SELECT 
            etapa,
            CASE tipo_evento
                WHEN 'CANCELACION' THEN 'CANCELADO'
                WHEN 'TRANSICION_INVALIDA' THEN 'TRANSICION_INVALIDA'
                ELSE tipo_evento
            END AS resultado,
            detalles AS motivo,
            0 AS rendimiento,
            0 AS acidez,
            0 AS peroxidos,
            tx_hash,
            fecha AS fecha_hora
        FROM historial_eventos 
        WHERE blockchain_id = ? 
        
        ORDER BY fecha_hora ASC
        `,
        [idLoteBlockchain, idLoteBlockchain]
    );
}

function construirConsultaLotes({ search = "", incluirPaginacion = true, page = 1, limit = 10 }) {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dateLimit = threeYearsAgo.toISOString().split("T")[0];

    let query = "SELECT id, codigo_lote as codigo, fecha_inicio as fechaRecepcion, variedad, peso_kg as kg, blockchain_id as _blockchain_id, hash_integridad, tx_creacion_hash, etapa_actual, estado FROM lotes WHERE fecha_inicio >= ?";
    const params = [dateLimit];

    if (search) {
        query += " AND codigo_lote LIKE ?";
        params.push(`%${search}%`);
    }

    if (incluirPaginacion) {
        const offset = (Number(page) - 1) * Number(limit);
        query += " ORDER BY fecha_inicio DESC LIMIT ? OFFSET ?";
        params.push(Number(limit), Number(offset));
    } else {
        query += " ORDER BY fecha_inicio DESC";
    }

    return { query, params, dateLimit };
}

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

        if (!eventLog) {
            throw new Error("No se encontró el evento 'LoteCreado' en la transacción. Verifica que el contrato emita el evento correctamente.");
        }

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
        console.log(error);
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});


//OBTENER LOTE POR CÓDIGO (DB -> Smart Contract)

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


// CANCELAR LOTE (Botón de pánico)

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

        await db.run(
            `UPDATE lotes SET estado = 'CANCELADO' WHERE blockchain_id = ?`,
            [loteDb.blockchain_id]
        );

        await registrarEventoHistorial({
            blockchainId: loteDb.blockchain_id,
            tipoEvento: "CANCELACION",
            etapa: "CANCELADO",
            detalles: motivo,
            txHash: tx.hash,
        });

        res.json({ success: true, message: `Lote '${codigoLote}' cancelado permanentemente en la Blockchain.`, txHash: tx.hash });

    } catch (error) {
        res.status(400).json({ success: false, error: parseBlockchainError(error) });
    }
});


// AVANZAR ETAPA Y GUARDAR EN BITÁCORA
router.post("/avanzar-etapa", async (req, res) => {
    const { idLoteBlockchain, etapa, rendimiento, acidez, peroxidos } = req.body;
    const historyDb = getHistoryDB();

    try {
        // Esto NO gasta gas. Atrapa los Custom Errors (ej: Lote Cancelado, etc.)
        await contract.avanzarEtapa.staticCall(
            idLoteBlockchain,
            etapa,
            Number(rendimiento) || 0,
            Number(acidez) || 0,
            Number(peroxidos) || 0
        );

        // Se inyectan 500,000 de gasLimit para que la EVM no se asfixie jamás.
        const tx = await contract.avanzarEtapa(
            idLoteBlockchain,
            etapa,
            Number(rendimiento) || 0,
            Number(acidez) || 0,
            Number(peroxidos) || 0,
            { gasLimit: 500000 } // <-- EL SALVAVIDAS
        );

        console.log(`⏳ Esperando confirmación de Blockchain (Tx: ${tx.hash})...`);
        const receipt = await tx.wait();

        // 2. Extraer la resolución oficial desde los Eventos de la Blockchain
        const eventLog = receipt.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === 'AvanceEtapa'; }
            catch { return false; }
        });

        let resultadoStr = "DESCONOCIDO";
        let motivoStr = "Sin observaciones";
        const etapaStr = ETAPAS[etapa];

        if (eventLog) {
            const parsedLog = contract.interface.parseLog(eventLog);
            resultadoStr = RESULTADOS[Number(parsedLog.args[2])]; // ej: APROBADO, OBSERVADO
            motivoStr = parsedLog.args[3]; // ej: "Calidad Extra Virgen"
        }

        // Guardar la transición en la BD
        // Usamos formato ISO 8601 para la fecha y hora
        const fechaHora = new Date().toISOString();

        await historyDb.run(
            `INSERT INTO transiciones (
                blockchain_id, etapa, resultado, motivo, rendimiento, acidez, peroxidos, tx_hash, fecha_hora
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idLoteBlockchain,
                etapaStr,
                resultadoStr,
                motivoStr,
                rendimiento || 0,
                acidez || 0,
                peroxidos || 0,
                tx.hash,
                fechaHora
            ]
        );

        const db = getDB();
        await db.run(
            `UPDATE lotes SET etapa_actual = ?, estado = ? WHERE blockchain_id = ?`,
            [etapaStr, resultadoStr, idLoteBlockchain]
        );

        res.json({
            success: true,
            message: `Lote avanzado a ${etapaStr}. Resolución: ${resultadoStr}.`,
            data: {
                txHash: tx.hash,
                motivo: motivoStr,
                fechaHora: fechaHora
            }
        });

    } catch (error) {
        console.error("Error:", error);
        const mensajeError = parseBlockchainError(error);

        if (mensajeError.includes("Transición Inválida") || mensajeError.includes("Operación denegada")) {
            let txHash = null;

            try {
                txHash = await registrarIntentoInvalidoEnBlockchain(idLoteBlockchain, etapa, mensajeError);
            } catch (loggingError) {
                console.error("No se pudo registrar el intento inválido en blockchain:", loggingError);
            }

            await registrarEventoHistorial({
                blockchainId: idLoteBlockchain,
                tipoEvento: "TRANSICION_INVALIDA",
                etapa: ETAPAS[etapa] || String(etapa),
                detalles: mensajeError,
                txHash,
            });
        }

        res.status(400).json({ success: false, error: mensajeError });
    }
});

router.post("/registrar-intento-transicion", async (req, res) => {
    const { idLoteBlockchain, etapaDestino, motivo } = req.body;

    if (!idLoteBlockchain || etapaDestino === undefined) {
        return res.status(400).json({ success: false, error: "Se requiere idLoteBlockchain y etapaDestino." });
    }

    try {
        const detalle = motivo || `Intento de transición inválida hacia ${ETAPAS[etapaDestino] || etapaDestino}.`;
        let txHash = null;

        try {
            txHash = await registrarIntentoInvalidoEnBlockchain(idLoteBlockchain, etapaDestino, detalle);
        } catch (loggingError) {
            console.error("No se pudo registrar el intento inválido en blockchain:", loggingError);
        }

        await registrarEventoHistorial({
            blockchainId: idLoteBlockchain,
            tipoEvento: "TRANSICION_INVALIDA",
            etapa: ETAPAS[etapaDestino] || String(etapaDestino),
            detalles: detalle,
            txHash,
        });

        res.json({
            success: true,
            message: txHash
                ? "Intento inválido registrado en auditoría y blockchain."
                : "Intento inválido registrado en auditoría local.",
            txHash,
        });
    } catch (error) {
        console.error("Error al registrar intento inválido:", error);
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

// OBTENER HISTORIAL DE UN LOTE (Línea de tiempo)
router.get("/historial/:idLoteBlockchain", async (req, res) => {
    const { idLoteBlockchain } = req.params;
    const historyDb = getHistoryDB();

    try {
        const historial = await obtenerHistorialUnificado(historyDb, idLoteBlockchain);

        if (historial.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No se encontró historial para este lote. O no existe, o aún está en su etapa inicial."
            });
        }

        res.json({
            success: true,
            cantidadEventos: historial.length,
            data: historial
        });

    } catch (error) {
        console.error("❌ Error al consultar el historial:", error);
        res.status(500).json({
            success: false,
            error: "Error interno al consultar la base de datos de auditoría."
        });
    }
});

router.get("/historial-sqlite/:idSqlite", async (req, res) => {
    const { idSqlite } = req.params;
    const db = getDB();
    const historyDb = getHistoryDB();

    try {
        const resolved = await obtenerBlockchainIdPorSqlite(db, idSqlite);
        if (resolved.error) {
            return res.status(404).json({ success: false, message: resolved.error });
        }

        const historial = await obtenerHistorialUnificado(historyDb, resolved.blockchainId);

        if (historial.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No se encontró historial para este lote."
            });
        }

        res.json({
            success: true,
            cantidadEventos: historial.length,
            data: historial
        });
    } catch (error) {
        console.error("❌ Error al consultar historial por id SQLite:", error);
        res.status(500).json({
            success: false,
            error: "Error interno al consultar la base de datos de auditoría."
        });
    }
});

router.get("/historial/:idLoteBlockchain/export", async (req, res) => {
    const { idLoteBlockchain } = req.params;
    const historyDb = getHistoryDB();

    try {
        const historial = await obtenerHistorialUnificado(historyDb, idLoteBlockchain);

        if (historial.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No se encontró historial para este lote."
            });
        }

        const rows = historial.map((evento, index) => ({
            orden: index + 1,
            etapa: evento.etapa,
            resultado: evento.resultado,
            motivo: evento.motivo,
            rendimiento: evento.rendimiento,
            acidez: evento.acidez,
            peroxidos: evento.peroxidos,
            tx_hash: evento.tx_hash || "",
            fecha_hora: evento.fecha_hora,
        }));

        const buffer = buildExcelBuffer({ sheetName: "HistorialLote", rows });
        sendExcelFile(res, {
            buffer,
            fileName: `historial_lote_${idLoteBlockchain}.xlsx`
        });
    } catch (error) {
        console.error("❌ Error al exportar historial de lote:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar historial de lote." });
    }
});

router.get("/historial-sqlite/:idSqlite/export", async (req, res) => {
    const { idSqlite } = req.params;
    const db = getDB();
    const historyDb = getHistoryDB();

    try {
        const resolved = await obtenerBlockchainIdPorSqlite(db, idSqlite);
        if (resolved.error) {
            return res.status(404).json({ success: false, message: resolved.error });
        }

        const historial = await obtenerHistorialUnificado(historyDb, resolved.blockchainId);

        if (historial.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No se encontró historial para este lote."
            });
        }

        const rows = historial.map((evento, index) => ({
            orden: index + 1,
            etapa: evento.etapa,
            resultado: evento.resultado,
            motivo: evento.motivo,
            rendimiento: evento.rendimiento,
            acidez: evento.acidez,
            peroxidos: evento.peroxidos,
            tx_hash: evento.tx_hash || "",
            fecha_hora: evento.fecha_hora,
        }));

        const buffer = buildExcelBuffer({ sheetName: "HistorialLote", rows });
        sendExcelFile(res, {
            buffer,
            fileName: `historial_lote_sqlite_${idSqlite}.xlsx`
        });
    } catch (error) {
        console.error("❌ Error al exportar historial por id SQLite:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar historial de lote." });
    }
});

// OBTENER TABLERO KANBAN

router.get("/tablero", async (req, res) => {
    const db = getDB();

    try {
        // Traemos todos los lotes que NO estén cancelados
        const lotesActivos = await db.all(
            `SELECT blockchain_id, codigo_lote, variedad, peso_kg, etapa_actual, estado 
             FROM lotes 
             WHERE estado != 'CANCELADO' AND blockchain_id IS NOT NULL`
        );

        // calcular índice de etapa basado en el arreglo ETAPAS (usado en frontend)
        const data = lotesActivos.map((l) => {
            const etapa_index = ETAPAS.findIndex((e) => e === l.etapa_actual);
            return { ...l, etapa_index };
        });

        // Opcional: Podés enviar la lista plana o agruparla por etapa desde acá
        // Para la mayoría de librerías Kanban de Frontend, una lista plana es ideal.
        res.json({
            success: true,
            total: data.length,
            data
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar el tablero operativo." });
    }
});

// GET: Historial de lotes (Paginado, búsqueda y últimos 3 años)
router.get("/lotes", async (req, res) => {
    const { search = "", page = 1, limit = 10 } = req.query;
    const db = getDB();
    const historyDb = getHistoryDB();

    const { query: queryBase, params: paramsBase } = construirConsultaLotes({
        search,
        incluirPaginacion: false,
    });

    // Contar el total para la paginación
    const countQuery = `SELECT COUNT(*) as total FROM (${queryBase})`;
    const totalRow = await db.get(countQuery, paramsBase);
    const total = totalRow ? totalRow.total : 0;

    const { query, params } = construirConsultaLotes({
        search,
        incluirPaginacion: true,
        page,
        limit,
    });

    const lotes = await db.all(query, params);

    // Incluir historial para cada lote
    const lotesConHistorial = await Promise.all(lotes.map(async (lote) => {
        const historial = await historyDb.all(
            `SELECT etapa, resultado, motivo, rendimiento, acidez, peroxidos, tx_hash, fecha_hora 
             FROM transiciones 
             WHERE blockchain_id = ? 
             ORDER BY fecha_hora ASC`,
            [lote._blockchain_id]
        );
        const { _blockchain_id, ...publicLote } = lote;
        return { ...publicLote, historial: historial || [] };
    }));

    res.json({
        data: lotesConHistorial,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit)
    });
});

router.get("/lotes/export", async (req, res) => {
    const { search = "" } = req.query;
    const db = getDB();
    const historyDb = getHistoryDB();

    try {
        const { query, params } = construirConsultaLotes({
            search,
            incluirPaginacion: false,
        });

        const lotes = await db.all(query, params);

        if (lotes.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No hay lotes para exportar con los filtros actuales."
            });
        }

        const rows = await Promise.all(lotes.map(async (lote) => {
            const eventos = lote._blockchain_id
                ? await obtenerHistorialUnificado(historyDb, lote._blockchain_id)
                : [];

            return {
                id_sqlite: lote.id,
                codigo: lote.codigo,
                fecha_recepcion: lote.fechaRecepcion,
                variedad: lote.variedad,
                kg: lote.kg,
                etapa_actual: lote.etapa_actual,
                estado: lote.estado,
                hash_integridad: lote.hash_integridad || "",
                tx_creacion_hash: lote.tx_creacion_hash || "",
                cantidad_eventos_historial: eventos.length,
            };
        }));

        const buffer = buildExcelBuffer({ sheetName: "Lotes", rows });
        sendExcelFile(res, {
            buffer,
            fileName: "lotes_ultimos_3_anios.xlsx"
        });
    } catch (error) {
        console.error("❌ Error al exportar lotes:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar lotes." });
    }
});


export default router;