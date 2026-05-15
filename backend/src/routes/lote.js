import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";
import { getHistoryDB } from "../config/history_db.js";
import { registrarEventoHistorial } from "../utils/historialHelper.js";
import {
    contract,
    wallet,
    parseBlockchainError,
    ETAPAS,
    RESULTADOS,
    createLoteOnChain,
    advanceLoteOnChain,
    cancelLoteOnChain,
    registerInvalidTransitionOnChain,
    getLoteOnChain,
} from "../config/blockchain.js";
import { buildExcelBuffer, sendExcelFile } from "../utils/excelExport.js";

const router = express.Router();

let soporteRegistroInvalidoOnChain = null;


/* 
* Verifica estáticamente si el contrato desplegado posee la función de registro de transiciones inválidas.
 */
async function contratoSoportaRegistroInvalido() {
    if (soporteRegistroInvalidoOnChain !== null) {
        return soporteRegistroInvalidoOnChain;
    }

    const selector = contract.interface.getFunction("registrarTransicionInvalida").selector.slice(2).toLowerCase();
    const deployedCode = await wallet.provider.getCode(contract.target);

    soporteRegistroInvalidoOnChain = deployedCode.toLowerCase().includes(selector);
    return soporteRegistroInvalidoOnChain;
}

/* 
* Ejecuta la transacción en la Blockchain para dejar constancia de un intento de violación del flujo.
 */
async function registrarIntentoInvalidoEnBlockchain(blockchainId, etapaSolicitada, motivo) {
    if (!await contratoSoportaRegistroInvalido()) {
        return null;
    }

    const result = await registerInvalidTransitionOnChain(blockchainId, etapaSolicitada, motivo);
    return result.txHash;
}

/* 
* Obtiene el ID asignado por el Smart Contract buscando mediante la clave primaria local.
 */
async function obtenerBlockchainIdPorSqlite(db, idSqlite) {
    const lote = await db.get("SELECT blockchain_id, codigo_lote FROM lotes WHERE id_lote = ?", [idSqlite]);

    if (!lote) {
        return { error: "Lote no encontrado." };
    }

    if (!lote.blockchain_id) {
        return { error: `El lote '${lote.codigo_lote}' no está sincronizado con blockchain.` };
    }

    return { blockchainId: lote.blockchain_id };
}

/* 
* Consulta la base de datos de auditoría histórica utilizando JOINs para resolver los textos
 * a partir de las tablas de catálogo.
 */
async function obtenerHistorialUnificado(historyDb, idLoteBlockchain) {
    return historyDb.all(
        `
        SELECT 
            e.nombre AS etapa,
            ev.nombre AS resultado,
            te.nombre AS tipo_evento,
            h.detalles AS motivo,
            h.tx_hash,
            h.fecha_registro AS fecha_hora
        FROM historial_eventos h
        INNER JOIN etapas e ON h.id_etapa_relacionada = e.id
        INNER JOIN estados_validacion ev ON h.id_estado_resultado = ev.id
        INNER JOIN tipos_evento te ON h.id_tipo_evento = te.id
        WHERE h.blockchain_id = ?
        ORDER BY h.fecha_registro ASC
        `,
        [idLoteBlockchain]
    );
}

function extraerCalidadBlockchain(observaciones) {
    if (!observaciones) {
        return null;
    }

    const texto = String(observaciones).trim();
    if (!texto) {
        return null;
    }

    if (/^analisis quimico:/i.test(texto)) {
        return texto;
    }

    if (/^calidad\s+/i.test(texto)) {
        return `Analisis Quimico: ${texto}`;
    }

    if (/lampante|no apto/i.test(texto)) {
        return `Analisis Quimico: ${texto}`;
    }

    return null;
}

/* 
* Construye la consulta SQL dinámica para listar los lotes cruzando la información
 * de las tablas catálogo para enviar textos legibles al frontend.
 */
function construirConsultaLotes({ search = "", incluirPaginacion = true, page = 1, limit = 10 }) {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const dateLimit = threeYearsAgo.toISOString().split("T")[0];

    let query = `
        SELECT 
            l.id_lote AS id, 
            l.codigo_lote AS codigo, 
            l.fecha_inicio AS fechaRecepcion, 
            v.nombre AS variedad, 
            l.peso_kg AS kg, 
            l.blockchain_id AS _blockchain_id, 
            l.hash_integridad, 
            l.tx_creacion_hash, 
            e.nombre AS etapa_actual, 
            ev.nombre AS estado 
        FROM lotes l
        INNER JOIN variedades v ON l.id_variedad = v.id
        INNER JOIN etapas e ON l.id_etapa = e.id
        INNER JOIN estados ev ON l.id_estado_validacion = ev.id
        WHERE l.fecha_inicio >= ?
    `;
    const params = [dateLimit];

    if (search) {
        query += " AND l.codigo_lote LIKE ?";
        params.push(`%${search}%`);
    }

    if (incluirPaginacion) {
        const offset = (Number(page) - 1) * Number(limit);
        query += " ORDER BY l.fecha_inicio DESC LIMIT ? OFFSET ?";
        params.push(Number(limit), Number(offset));
    } else {
        query += " ORDER BY l.fecha_inicio DESC";
    }

    return { query, params, dateLimit };
}

/* * Incrementa la cantidad de aceitunas disponibles para producción de manera local.
 */
router.post("/abastecer-tolva", async (req, res) => {
    const { kilos } = req.body;
    const db = getDB();

    try {
        const tolva = await db.get("SELECT peso_disponible FROM tolva WHERE id = 1");
        const nuevoPeso = tolva.peso_disponible + kilos;

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

/* * Recibe los datos iniciales, verifica el stock, inserta el lote en la base normalizada
 * y envía el hash a la Blockchain.
 */
router.post("/crear-lote", async (req, res) => {
    const { codigoLote, fechaInicio, idVariedad, pesoKg } = req.body;
    const db = getDB();
    let txActiva = false;

    try {
        await db.exec("BEGIN TRANSACTION");
        txActiva = true;

        const tolva = await db.get("SELECT peso_disponible FROM tolva WHERE id = 1");
        if (tolva.peso_disponible < pesoKg) {
            await db.exec("ROLLBACK");
            txActiva = false;
            return res.status(400).json({
                success: false,
                error: `No hay suficientes aceitunas. Disponible: ${tolva.peso_disponible}kg, Solicitado: ${pesoKg}kg.`
            });
        }

        const variedadDb = await db.get("SELECT nombre FROM variedades WHERE id = ?", [idVariedad]);
        if (!variedadDb) {
            await db.exec("ROLLBACK");
            txActiva = false;
            return res.status(400).json({ success: false, error: "ID de variedad inválido." });
        }

        let idSqlite;
        try {
            const result = await db.run(
                `INSERT INTO lotes (codigo_lote, fecha_inicio, id_variedad, peso_kg, id_etapa, id_estado_validacion) VALUES (?, ?, ?, ?, 0, 0)`,
                [codigoLote, fechaInicio, idVariedad, pesoKg]
            );
            idSqlite = result.lastID;
        } catch (dbError) {
            if (dbError.message.includes("UNIQUE constraint failed") || dbError.code === "SQLITE_CONSTRAINT") {
                await db.exec("ROLLBACK");
                txActiva = false;
                return res.status(400).json({
                    success: false,
                    error: `El código de lote '${codigoLote}' ya existe. Debe ser único.`
                });
            }
            throw dbError;
        }

        const dataToHash = `${idSqlite}-${codigoLote}-${fechaInicio}-${variedadDb.nombre}-${pesoKg}`;
        const hashIntegridad = crypto.createHash('sha256').update(dataToHash).digest('hex');

        const chainResult = await createLoteOnChain(hashIntegridad, variedadDb.nombre, pesoKg);
        const blockchainId = chainResult.blockchainId;

        await db.run(
            `UPDATE lotes SET blockchain_id = ?, hash_integridad = ?, tx_creacion_hash = ? WHERE id_lote = ?`,
            [blockchainId, hashIntegridad, chainResult.txHash, idSqlite]
        );

        const nuevoPesoTolva = tolva.peso_disponible - pesoKg;
        const hashTolva = crypto.createHash('sha256').update(`TOLVA-${nuevoPesoTolva}`).digest('hex');
        await db.run("UPDATE tolva SET peso_disponible = ?, hash_integridad = ? WHERE id = 1", [nuevoPesoTolva, hashTolva]);

        await db.exec("COMMIT");
        txActiva = false;

        try {
            await registrarEventoHistorial({
                blockchainId: blockchainId,
                idTipoEvento: 1,
                idEtapa: 0,
                idEstadoResultado: 0,
                detalles: "Lote registrado y anclado a la cadena",
                txHash: chainResult.txHash
            });
        } catch (historyError) {
            console.error("No se pudo registrar el evento histórico del lote creado:", historyError);
        }

        res.json({ success: true, data: { idSqlite, blockchainId, hashIntegridad, stockRestante: nuevoPesoTolva } });

    } catch (error) {
        if (txActiva) {
            try {
                await db.exec("ROLLBACK");
            } catch {
                // Nada adicional que hacer si el rollback falla.
            }
        }
        console.log(error);
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});

/* * Obtiene el ID de Blockchain a través de SQLite y luego extrae los datos directos del Smart Contract.
 */
router.get("/consultar/:codigoLote", async (req, res) => {
    const { codigoLote } = req.params;
    const db = getDB();

    try {
        const loteDb = await db.get("SELECT blockchain_id FROM lotes WHERE codigo_lote = ?", [codigoLote]);

        if (!loteDb || !loteDb.blockchain_id) {
            return res.status(404).json({ success: false, error: `El lote '${codigoLote}' no existe o no está sincronizado.` });
        }

        const loteSC = await getLoteOnChain(loteDb.blockchain_id);

        res.json({
            success: true,
            data: {
                codigoLote: codigoLote,
                variedad: loteSC.variedad,
                pesoKg: Number(loteSC.pesoKg),
                kgAceiteNeto: Number(loteSC.kgAceiteNeto),
                kpis: {
                    rendimiento: Number(loteSC.kpis.rendimiento),
                    // Revertir la conversión x100 aplicada antes de enviar al contrato
                    acidez: Number(loteSC.kpis.acidez) / 100,
                    peroxidos: Number(loteSC.kpis.peroxidos),
                },
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

// GET: Catálogo de Variedades
router.get("/variedades", async (req, res) => {
    const db = getDB();
    try {
        const variedades = await db.all("SELECT id, nombre FROM variedades ORDER BY nombre ASC");
        res.json({ success: true, data: variedades });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al obtener las variedades" });
    }
});

router.get("/motivos-cancelacion", async (_req, res) => {
    const historyDb = getHistoryDB();

    try {
        const rows = await historyDb.all(
            `SELECT DISTINCT TRIM(detalles) AS motivo
             FROM historial_eventos
             WHERE TRIM(COALESCE(detalles, '')) <> ''
               AND id_tipo_evento = 3
               AND id_estado_resultado = 3
             ORDER BY fecha_registro DESC
             LIMIT 100`
        );

        res.json({
            success: true,
            data: {
                motivos: rows.map((row) => row.motivo),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al obtener motivos de cancelación." });
    }
});


/* * Ejecuta la transacción para inutilizar un lote en el contrato y actualiza las bases de datos a estado CANCELADO (ID 3).
 */
router.post("/cancelar-lote", async (req, res) => {
    const { codigoLote, motivo } = req.body;
    const db = getDB();

    if (!codigoLote || !motivo) {
        return res.status(400).json({ success: false, error: "Se requiere codigoLote y motivo." });
    }

    try {
        const loteDb = await db.get("SELECT blockchain_id, id_etapa FROM lotes WHERE codigo_lote = ?", [codigoLote]);
        if (!loteDb) return res.status(404).json({ success: false, error: "Lote no encontrado." });

        const chainResult = await cancelLoteOnChain(loteDb.blockchain_id, motivo);

        await db.run(
            `UPDATE lotes SET id_estado_validacion = 3 WHERE blockchain_id = ?`,
            [loteDb.blockchain_id]
        );

        await registrarEventoHistorial({
            blockchainId: loteDb.blockchain_id,
            idTipoEvento: 3,
            idEtapa: loteDb.id_etapa,
            idEstadoResultado: 3,
            detalles: motivo,
            txHash: chainResult.txHash,
        });

        res.json({ success: true, message: `Lote '${codigoLote}' cancelado permanentemente en la Blockchain.`, txHash: chainResult.txHash });

    } catch (error) {
        res.status(400).json({ success: false, error: parseBlockchainError(error) });
    }
});

/* * Valida y registra el avance de un lote a la siguiente etapa de producción.
 * Lee los eventos de la transacción para conocer la clasificación final asignada por el DSL.
 */
router.post("/avanzar-etapa", async (req, res) => {
    const { idLoteBlockchain, codigoLote, etapa, kgAceiteNeto, acidez, peroxidos } = req.body;

    // El contrato almacena acidez como entero x100 (ej: 0.5% → 50).
    // Peroxidos y kgAceiteNeto son enteros reales, no requieren conversión.
    const acidezOnChain = Math.round(Number(acidez) * 100);

    try {
        const db = getDB();

        // Validaciones de transiciones que requieren datos específicos
        // Transición 3-4: Centrifugado → Decantado (requiere kg de aceite neto)
        if (etapa === 4) {
            if (!kgAceiteNeto || Number(kgAceiteNeto) <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: "La transición de Centrifugado a Decantado requiere una masa neta de aceite mayor a 0 kg." 
                });
            }
        }

        // Transición 5-6: Analisis → Almacenamiento (requiere kg, acidez y peroxidos)
        if (etapa === 6) {
            if (!kgAceiteNeto || Number(kgAceiteNeto) <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: "La transición a Almacenamiento requiere una masa neta final de aceite mayor a 0 kg." 
                });
            }
            if (acidez === null || acidez === undefined || Number(acidez) < 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: "La transición a Almacenamiento requiere un índice de acidez válido (no negativo)." 
                });
            }
            if (peroxidos === null || peroxidos === undefined || Number(peroxidos) < 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: "La transición a Almacenamiento requiere un índice de peróxidos válido (no negativo)." 
                });
            }
        }

        // Validar que el kgAceiteNeto no sea mayor al peso del lote
        if (kgAceiteNeto) {
            const loteInfo = await db.get(`SELECT peso_kg FROM lotes WHERE blockchain_id = ?`, [idLoteBlockchain]);
            if (loteInfo && Number(kgAceiteNeto) > loteInfo.peso_kg) {
                return res.status(400).json({ success: false, error: `La masa neta de aceite (${kgAceiteNeto} kg) no puede ser mayor que el peso total del lote (${loteInfo.peso_kg} kg).` });
            }
        }

        const chainResult = await advanceLoteOnChain(idLoteBlockchain, etapa, kgAceiteNeto, acidezOnChain, peroxidos);

        let idEstado = 0;
        let motivoStr = "Sin observaciones";
        const etapaStr = ETAPAS[etapa];

        if (chainResult.event) {
            idEstado = Number(chainResult.event.args[2] ?? 0);
            motivoStr = chainResult.event.args[3] || "Transición OK";
        }

        // Al llegar a ALMACENAMIENTO (etapa 6) guardar la clasificación de calidad y los litros estimados
        if (etapa === 6) {
            const litrosRestantes = kgAceiteNeto ? Number(kgAceiteNeto) / 0.916 : 0;
            if (codigoLote) {
                await db.run(
                    `UPDATE lotes SET id_etapa = ?, id_estado_validacion = ?, calidad = ?, litros_restantes = ? WHERE blockchain_id = ? AND codigo_lote = ?`,
                    [etapa, idEstado, motivoStr, litrosRestantes, idLoteBlockchain, codigoLote]
                );
            } else {
                await db.run(
                    `UPDATE lotes SET id_etapa = ?, id_estado_validacion = ?, calidad = ?, litros_restantes = ? WHERE blockchain_id = ?`,
                    [etapa, idEstado, motivoStr, litrosRestantes, idLoteBlockchain]
                );
            }
        } else {
            if (codigoLote) {
                await db.run(
                    `UPDATE lotes SET id_etapa = ?, id_estado_validacion = ? WHERE blockchain_id = ? AND codigo_lote = ?`,
                    [etapa, idEstado, idLoteBlockchain, codigoLote]
                );
            } else {
                await db.run(
                    `UPDATE lotes SET id_etapa = ?, id_estado_validacion = ? WHERE blockchain_id = ?`,
                    [etapa, idEstado, idLoteBlockchain]
                );
            }
        }

        const fechaHora = new Date().toISOString();
        // Guardar acidez en su valor decimal original para legibilidad humana en el historial.
        const detallesJSON = JSON.stringify({ motivo: motivoStr, kgAceiteNeto, acidez: Number(acidez), peroxidos });

        await registrarEventoHistorial({
            blockchainId: idLoteBlockchain,
            idTipoEvento: 2,
            idEtapa: etapa,
            idEstadoResultado: idEstado,
            detalles: detallesJSON,
            txHash: chainResult.txHash,
            fecha: fechaHora
        });

        const resultadoStr = RESULTADOS[idEstado] || "DESCONOCIDO";

        res.json({
            success: true,
            message: `Lote avanzado a ${etapaStr}. Resolución: ${resultadoStr}.`,
            data: {
                txHash: chainResult.txHash,
                motivo: motivoStr,
                fechaHora: fechaHora
            }
        });

    } catch (error) {
        console.error("Error:", error);
        const mensajeError = parseBlockchainError(error);

        if (mensajeError.includes("Transición Inválida") || mensajeError.includes("Operación denegada") || mensajeError.includes("invalida")) {
            let txHash = null;

            try {
                txHash = await registrarIntentoInvalidoEnBlockchain(idLoteBlockchain, etapa, mensajeError);
            } catch (loggingError) {
                console.error("No se pudo registrar el intento inválido en blockchain:", loggingError);
            }

            await registrarEventoHistorial({
                blockchainId: idLoteBlockchain,
                idTipoEvento: 3,
                idEtapa: etapa,
                idEstadoResultado: 2,
                detalles: mensajeError,
                txHash
            });
        }

        res.status(400).json({ success: false, error: mensajeError });
    }
});

/* * Recibe reportes forzados de error en las transiciones solicitadas directamente desde el frontend.
 */
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
            idTipoEvento: 3,
            idEtapa: etapaDestino,
            idEstadoResultado: 2,
            detalles: detalle,
            txHash
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

/* * Recalcula de manera determinista el hash de los datos almacenados en SQLite y lo compara contra
 * la raíz inmutable asegurada en el Smart Contract.
 */
router.get("/auditar/:idSqlite", async (req, res) => {
    const { idSqlite } = req.params;
    const db = getDB();

    try {
        const loteDB = await db.get(
            `SELECT l.*, v.nombre AS variedad 
             FROM lotes l 
             INNER JOIN variedades v ON l.id_variedad = v.id 
             WHERE l.id_lote = ?`,
            [idSqlite]
        );

        if (!loteDB) {
            return res.status(404).json({ success: false, error: "Lote no encontrado en la base de datos local." });
        }

        if (!loteDB.blockchain_id) {
            return res.status(400).json({ success: false, error: "Este lote aún no ha sido sincronizado con la Blockchain." });
        }

        const dataToHash = `${loteDB.id_lote}-${loteDB.codigo_lote}-${loteDB.fecha_inicio}-${loteDB.variedad}-${loteDB.peso_kg}`;
        const hashRecalculado = crypto.createHash('sha256').update(dataToHash).digest('hex');

        const loteBlockchain = await getLoteOnChain(loteDB.blockchain_id);
        const hashEnBlockchain = loteBlockchain.idBaseDatos;

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
                ? "Los datos son auténticos y no han sido alterados."
                : "ALERTA DE SEGURIDAD: Los datos en la base de datos han sido modificados ilegalmente."
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Error al auditar: " + error.message });
    }
});

/* * Solicita el historial unificado consultando mediante el identificador principal on-chain.
 */
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
        console.error("Error al consultar el historial:", error);
        res.status(500).json({
            success: false,
            error: "Error interno al consultar la base de datos de auditoría."
        });
    }
});

/* * Solicita el historial unificado resolviendo primero el ID de SQLite hacia el ID on-chain correspondiente.
 */
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
        console.error("Error al consultar historial por id SQLite:", error);
        res.status(500).json({
            success: false,
            error: "Error interno al consultar la base de datos de auditoría."
        });
    }
});

/* * Formatea y exporta a Excel el historial en base al ID de Blockchain.
 */
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

        const rows = historial.map((evento, index) => {
            let metricas = { rendimiento: 0, acidez: 0, peroxidos: 0 };
            try { metricas = JSON.parse(evento.motivo); } catch { }

            return {
                orden: index + 1,
                etapa: evento.etapa,
                resultado: evento.resultado,
                motivo: metricas.motivo || evento.motivo,
                rendimiento: metricas.rendimiento || 0,
                acidez: metricas.acidez || 0,
                peroxidos: metricas.peroxidos || 0,
                tx_hash: evento.tx_hash || "",
                fecha_hora: evento.fecha_hora,
            };
        });

        const buffer = buildExcelBuffer({ sheetName: "HistorialLote", rows });
        sendExcelFile(res, {
            buffer,
            fileName: `historial_lote_${idLoteBlockchain}.xlsx`
        });
    } catch (error) {
        console.error("Error al exportar historial de lote:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar historial de lote." });
    }
});

/* * Formatea y exporta a Excel el historial resolviendo desde la clave local de SQLite.
 */
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

        const rows = historial.map((evento, index) => {
            let metricas = { rendimiento: 0, acidez: 0, peroxidos: 0 };
            try { metricas = JSON.parse(evento.motivo); } catch { }

            return {
                orden: index + 1,
                etapa: evento.etapa,
                resultado: evento.resultado,
                motivo: metricas.motivo || evento.motivo,
                rendimiento: metricas.rendimiento || 0,
                acidez: metricas.acidez || 0,
                peroxidos: metricas.peroxidos || 0,
                tx_hash: evento.tx_hash || "",
                fecha_hora: evento.fecha_hora,
            };
        });

        const buffer = buildExcelBuffer({ sheetName: "HistorialLote", rows });
        sendExcelFile(res, {
            buffer,
            fileName: `historial_lote_sqlite_${idSqlite}.xlsx`
        });
    } catch (error) {
        console.error("Error al exportar historial por id SQLite:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar historial de lote." });
    }
});

/* * Entrega un listado plano de los lotes activos (cuyo estado no sea CANCELADO) 
 * calculando la columna requerida por el renderizado del Kanban en frontend.
 */
router.get("/tablero", async (req, res) => {
    const db = getDB();

    try {
        const lotesActivos = await db.all(
            `SELECT 
                l.id_lote,
                l.blockchain_id, 
                l.codigo_lote, 
                l.fecha_inicio,
                v.nombre AS variedad, 
                l.peso_kg, 
                e.nombre AS etapa_actual, 
                ev.nombre AS estado, 
                l.calidad,
                l.litros_restantes,
                CASE
                    WHEN l.id_etapa = 6 AND l.id_estado_validacion = 2 THEN 7
                    ELSE l.id_etapa
                END AS etapa_index
             FROM lotes l
             INNER JOIN variedades v ON l.id_variedad = v.id
             INNER JOIN etapas e ON l.id_etapa = e.id
             INNER JOIN estados ev ON l.id_estado_validacion = ev.id
                         WHERE l.id_estado_validacion != 3
                             AND l.blockchain_id IS NOT NULL
                             AND l.id_lote = (
                                        SELECT MAX(l2.id_lote)
                                        FROM lotes l2
                                        WHERE l2.blockchain_id = l.blockchain_id
                                            AND l2.id_estado_validacion != 3
                             )`
        );

        const dataBase = Array.isArray(lotesActivos) ? lotesActivos : [];

        // Enriquecer con datos on-chain para cubrir lotes existentes previos a la columna "calidad"
        // y exponer KPIs (rendimiento/acidez/peroxidos) al tablero.
        const data = await Promise.all(dataBase.map(async (lote) => {
            let loteSC = null;
            try {
                loteSC = await getLoteOnChain(lote.blockchain_id);
            } catch (chainError) {
                console.warn(`No se pudo consultar on-chain el lote ${lote.blockchain_id}:`, chainError?.message || chainError);
            }

            const calidadPersistida = extraerCalidadBlockchain(lote.calidad);
            const calidadOnChain = extraerCalidadBlockchain(loteSC?.observaciones);
            const calidadFinal = calidadPersistida || calidadOnChain || null;

            // Backfill para que lotes históricos en almacenamiento/venta tengan color sin reprocesarlos.
            if (calidadFinal && lote.calidad !== calidadFinal && (lote.etapa_index === 6 || lote.etapa_index === 7)) {
                await db.run(
                    `UPDATE lotes SET calidad = ? WHERE blockchain_id = ? AND codigo_lote = ?`,
                    [calidadFinal, lote.blockchain_id, lote.codigo_lote]
                );
            }

            return {
                id_lote: lote.id_lote,
                ...lote,
                calidad: calidadFinal,
                kg_aceite_neto: loteSC ? Number(loteSC.kgAceiteNeto) : null,
                rendimiento: loteSC ? Number(loteSC.kpis.rendimiento) : null,
                // Acidez on-chain está normalizada x100; para UI se devuelve en porcentaje real.
                acidez: loteSC ? Number(loteSC.kpis.acidez) / 100 : null,
                peroxidos: loteSC ? Number(loteSC.kpis.peroxidos) : null,
                litrosRestantes: lote.litros_restantes,
            };
        }));

        res.json({
            success: true,
            total: data.length,
            data,
            message: data.length === 0 ? "No hay lotes activos para mostrar en el tablero." : undefined
        });

    } catch (error) {
        console.error("Error en GET /api/lotes/tablero:", error);
        res.status(500).json({ success: false, error: "Error al cargar el tablero operativo." });
    }
});

/*
 * Devuelve los ultimos lotes creados para mostrar un resumen operativo en Inicio.
 */
router.get("/ultimos", async (_req, res) => {
    const db = getDB();

    try {
        const rows = await db.all(
            `SELECT
                l.id_lote AS id,
                l.codigo_lote AS codigo,
                l.fecha_inicio AS fechaRecepcion,
                v.nombre AS variedad,
                l.peso_kg AS kg,
                e.nombre AS etapaActual
             FROM lotes l
             INNER JOIN variedades v ON l.id_variedad = v.id
             INNER JOIN etapas e ON l.id_etapa = e.id
             ORDER BY l.id_lote DESC
             LIMIT 10`
        );

        return res.json({
            success: true,
            total: rows.length,
            data: rows,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "No se pudieron obtener los ultimos lotes.",
        });
    }
});

/* * Solicita una lista paginada de todos los lotes e incorpora para cada uno la matriz
 * de sus eventos históricos correspondientes.
 */
router.get("/lotes", async (req, res) => {
    const { search = "", page = 1, limit = 10 } = req.query;
    const db = getDB();
    const historyDb = getHistoryDB();

    const { query: queryBase, params: paramsBase } = construirConsultaLotes({
        search,
        incluirPaginacion: false,
    });

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

    const lotesConHistorial = await Promise.all(lotes.map(async (lote) => {
        const historial = await obtenerHistorialUnificado(historyDb, lote._blockchain_id);
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

/* * Agrupa la consulta base de datos operativos y los formatea dentro de un buffer binario 
 * listo para su descarga y análisis en planillas de cálculo de manera local.
 */
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
        console.error("Error al exportar lotes:", error);
        res.status(500).json({ success: false, error: "Error interno al exportar lotes." });
    }
});

export default router;