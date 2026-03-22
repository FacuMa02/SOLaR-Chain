import sqlite3 from "sqlite3";
import { open } from "sqlite";

let historyDbInstance = null;

export async function initHistoryDB() {
    if (historyDbInstance) return historyDbInstance;

    historyDbInstance = await open({
        filename: "./history.sqlite",
        driver: sqlite3.Database
    });

    console.log("📜 Base de datos Historial (history.sqlite) inicializada.");

    // Tabla diseñada específicamente para trazabilidad y auditoría
    await historyDbInstance.exec(`
        CREATE TABLE IF NOT EXISTS transiciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blockchain_id INTEGER NOT NULL,
            etapa TEXT NOT NULL,
            resultado TEXT NOT NULL,
            motivo TEXT,
            rendimiento REAL,
            acidez REAL,
            peroxidos REAL,
            tx_hash TEXT NOT NULL UNIQUE,
            fecha_hora TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS historial_eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blockchain_id INTEGER NOT NULL,
            tipo_evento TEXT NOT NULL, -- 'AVANCE', 'CANCELACION', 'ALERTA_SEGURIDAD'
            etapa TEXT NOT NULL,       -- En qué etapa ocurrió
            detalles TEXT,             -- Motivo del error o datos del avance
            tx_hash TEXT,
            fecha TEXT NOT NULL
        );
    `);

    const historialEventosInfo = await historyDbInstance.all(`PRAGMA table_info(historial_eventos)`);
    const hasTxHash = historialEventosInfo.some((column) => column.name === "tx_hash");

    if (!hasTxHash) {
        await historyDbInstance.exec(`ALTER TABLE historial_eventos ADD COLUMN tx_hash TEXT`);
    }

    return historyDbInstance;
}

export function getHistoryDB() {
    if (!historyDbInstance) throw new Error("La BD de historial no está inicializada.");
    return historyDbInstance;
}