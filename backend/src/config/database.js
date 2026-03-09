import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

let dbInstance = null;

export async function initDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: "./produccion.sqlite",
        driver: sqlite3.Database
    });

    console.log("💾 Base de datos SQLite inicializada.");

    // Crear tablas necesarias
    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS lotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_lote TEXT UNIQUE NOT NULL, 
            fecha_inicio TEXT NOT NULL,
            variedad TEXT NOT NULL,
            peso_kg REAL NOT NULL,
            blockchain_id INTEGER,
            hash_integridad TEXT,
            tx_creacion_hash TEXT,
            etapa_actual TEXT DEFAULT 'RECEPCION', -- NUEVO: Caché para el Kanban
            estado TEXT DEFAULT 'APROBADO'         -- NUEVO: Para filtrar los cancelados
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS tolva (
            id INTEGER PRIMARY KEY,
            peso_disponible REAL NOT NULL,
            hash_integridad TEXT NOT NULL
        );
    `);

    // Inicializar la tolva si está vacía
    const tolva = await dbInstance.get("SELECT * FROM tolva WHERE id = 1");
    if (!tolva) {
        const hashInicial = crypto.createHash('sha256').update(`TOLVA-0`).digest('hex');
        await dbInstance.run(
            `INSERT INTO tolva (id, peso_disponible, hash_integridad) VALUES (1, 0, ?)`,
            [hashInicial]
        );
    }

    return dbInstance;
}

// Función para obtener la instancia desde otros archivos
export function getDB() {
    if (!dbInstance) throw new Error("La base de datos no está inicializada.");
    return dbInstance;
}