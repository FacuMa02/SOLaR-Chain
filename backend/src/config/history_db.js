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
    `);

    return historyDbInstance;
}

export function getHistoryDB() {
    if (!historyDbInstance) throw new Error("La BD de historial no está inicializada.");
    return historyDbInstance;
}