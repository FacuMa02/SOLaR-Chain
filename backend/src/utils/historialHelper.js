import { getHistoryDB } from "../config/history_db.js";

/* * Registra un evento en la bitácora histórica normalizada.
 * Utiliza IDs referenciales para tipo de evento, etapa y resultado.
 */
export async function registrarEventoHistorial({ blockchainId, idTipoEvento, idEtapa, idEstadoResultado, detalles = "", txHash = null, responsableId = null, fecha = new Date().toISOString() }) {
    const historyDb = getHistoryDB();
    await historyDb.run(
        `INSERT INTO historial_eventos (
            blockchain_id,
            id_tipo_evento,
            id_etapa_relacionada,
            id_estado_resultado,
            tx_hash,
            detalles,
            responsable_id,
            fecha_registro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            blockchainId,
            idTipoEvento,
            idEtapa,
            idEstadoResultado,
            txHash,
            detalles,
            responsableId,
            fecha,
        ]
    );
}
