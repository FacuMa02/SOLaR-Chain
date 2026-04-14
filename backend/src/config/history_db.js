import sqlite3 from "sqlite3";
import { open } from "sqlite";

let historyDbInstance = null;

async function ensureColumnExists(db, tableName, columnName, columnSql) {
    const columns = await db.all(`PRAGMA table_info(${tableName})`);
    const exists = columns.some((col) => col.name === columnName);
    if (!exists) {
        await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
        console.log(`Migracion aplicada: ${tableName}.${columnName}`);
    }
}

export async function initHistoryDB() {
    if (historyDbInstance) return historyDbInstance;

    const db = await open({
        filename: "./history.sqlite",
        driver: sqlite3.Database
    });
    // Activamos las Claves Foráneas para garantizar la consistencia del historial
    await db.exec(`PRAGMA foreign_keys = ON;`);

    // ==========================================
    // 1. TABLAS DE CATÁLOGO (Espejo de Producción)
    // ==========================================

    await db.exec(`
        CREATE TABLE IF NOT EXISTS etapas (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO etapas (id, nombre) VALUES 
        (0, 'RECEPCION'), (1, 'MOLIENDA'), (2, 'BATIDO'), (3, 'CENTRIFUGADO'), 
        (4, 'DECANTACION'), (5, 'ANALISIS'), (6, 'ALMACENAMIENTO');
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS estados_validacion (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO estados_validacion (id, nombre) VALUES 
        (0, 'APROBADO'), (1, 'OBSERVADO'), (2, 'BLOQUEADO'), (3, 'CANCELADO');
    `);

    // Catálogo específico para el tipo de evento en la bitácora
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tipos_evento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO tipos_evento (id, nombre) VALUES 
        (1, 'CREACION_LOTE'), (2, 'TRANSICION_ETAPA'), (3, 'ALERTA_SEGURIDAD'), (4, 'OVERRIDE_CALIDAD');
    `);

    // ==========================================
    // 2. TABLA PRINCIPAL DE AUDITORÍA (Bitácora Normalizada)
    // ==========================================

    await db.exec(`
        CREATE TABLE IF NOT EXISTS historial_eventos (
            id_evento INTEGER PRIMARY KEY AUTOINCREMENT,
            blockchain_id INTEGER NOT NULL, -- El ID del lote en el Smart Contract
            id_tipo_evento INTEGER NOT NULL,
            id_etapa_relacionada INTEGER NOT NULL,
            id_estado_resultado INTEGER NOT NULL,
            tx_hash TEXT, -- El hash de la transacción en Hardhat/Ganache
            detalles TEXT, -- JSON o texto con los KPIs reportados en ese momento
            responsable_id INTEGER, -- ID del usuario que disparó el evento (referencia lógica a users.id)
            fecha_registro TEXT NOT NULL,
            
            FOREIGN KEY (id_tipo_evento) REFERENCES tipos_evento(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_etapa_relacionada) REFERENCES etapas(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_estado_resultado) REFERENCES estados_validacion(id) ON DELETE RESTRICT
        );
    `);

    // Compatibilidad con esquemas historicos previos de historial_eventos.
    await ensureColumnExists(db, "historial_eventos", "id_tipo_evento", "INTEGER");
    await ensureColumnExists(db, "historial_eventos", "id_etapa_relacionada", "INTEGER");
    await ensureColumnExists(db, "historial_eventos", "id_estado_resultado", "INTEGER");
    await ensureColumnExists(db, "historial_eventos", "responsable_id", "INTEGER");
    await ensureColumnExists(db, "historial_eventos", "fecha_registro", "TEXT");

    // Backfill minimo para filas legadas y para evitar NULLs en consultas normalizadas.
    await db.exec(`
        UPDATE historial_eventos
        SET id_tipo_evento = COALESCE(
            id_tipo_evento,
            CASE
                WHEN tipo_evento IN (1, '1', 'CREACION_LOTE') THEN 1
                WHEN tipo_evento IN (2, '2', 'TRANSICION_ETAPA') THEN 2
                WHEN tipo_evento IN (3, '3', 'ALERTA_SEGURIDAD') THEN 3
                WHEN tipo_evento IN (4, '4', 'OVERRIDE_CALIDAD') THEN 4
                ELSE 2
            END
        )
        WHERE id_tipo_evento IS NULL;

        UPDATE historial_eventos
        SET id_etapa_relacionada = COALESCE(
            id_etapa_relacionada,
            CASE
                WHEN etapa IN (0, '0', 'RECEPCION') THEN 0
                WHEN etapa IN (1, '1', 'MOLIENDA') THEN 1
                WHEN etapa IN (2, '2', 'BATIDO') THEN 2
                WHEN etapa IN (3, '3', 'CENTRIFUGADO') THEN 3
                WHEN etapa IN (4, '4', 'DECANTACION') THEN 4
                WHEN etapa IN (5, '5', 'ANALISIS') THEN 5
                WHEN etapa IN (6, '6', 'ALMACENAMIENTO') THEN 6
                ELSE 0
            END
        )
        WHERE id_etapa_relacionada IS NULL;

        UPDATE historial_eventos
        SET id_estado_resultado = COALESCE(id_estado_resultado, 0)
        WHERE id_estado_resultado IS NULL;

        UPDATE historial_eventos
        SET fecha_registro = COALESCE(fecha_registro, fecha, datetime('now'))
        WHERE fecha_registro IS NULL;
    `);

    console.log("Base de datos histórica desplegada.");
    historyDbInstance = db;
    return db;
}

export function getHistoryDB() {
    if (!historyDbInstance) throw new Error("La BD de historial no está inicializada.");
    return historyDbInstance;
}