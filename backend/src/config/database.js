import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

let dbInstance = null;

async function ensureColumnExists(db, tableName, columnName, columnSql) {
    const columns = await db.all(`PRAGMA table_info(${tableName})`);
    const exists = columns.some((col) => col.name === columnName);
    if (!exists) {
        await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
        console.log(`Migracion aplicada: ${tableName}.${columnName}`);
    }
}

export async function initDB() {
    if (dbInstance) return dbInstance;

    const db = await open({
        filename: "./produccion.sqlite",
        driver: sqlite3.Database
    });

    console.log("Base de datos SQLite inicializada.");

    // Activar chequeo de claves foráneas
    await db.exec(`PRAGMA foreign_keys = ON;`);


    // Tablas de Seguridad
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dni TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            fecha_creacion TEXT NOT NULL
        );
    `);

    // Tablas catálogo
    await db.exec(`
        CREATE TABLE IF NOT EXISTS variedades (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        -- Insertamos variedades típicas de la región
        INSERT OR IGNORE INTO variedades (id, nombre) VALUES 
        (1, 'Arauco'), (2, 'Arbequina'), (3, 'Hojiblanca'), (4, 'Picual'), (5, 'Manzanilla');
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS etapas (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        -- Respetando el enum de TrazabilidadDSL.sol
        INSERT OR IGNORE INTO etapas (id, nombre) VALUES 
        (0, 'RECEPCION'), (1, 'MOLIENDA'), (2, 'BATIDO'), (3, 'CENTRIFUGADO'), 
        (4, 'DECANTACION'), (5, 'ANALISIS'), (6, 'ALMACENAMIENTO');
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS estados (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        -- Respetando el enum ResultadoValidacion del DSL
        INSERT OR IGNORE INTO estados (id, nombre) VALUES 
        (0, 'APROBADO'), (1, 'OBSERVADO'), (2, 'BLOQUEADO'), (3, 'CANCELADO');
    `);

    // Compatibilidad con bases antiguas cuya tabla lotes sigue referenciando
    // estados_validacion en la FK. Mantener espejo evita errores SQLITE_ERROR
    // sin obligar a recrear la tabla lotes del usuario.
    await db.exec(`
        CREATE TABLE IF NOT EXISTS estados_validacion (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO estados_validacion (id, nombre) VALUES
        (0, 'APROBADO'), (1, 'OBSERVADO'), (2, 'BLOQUEADO'), (3, 'CANCELADO');
    `);

    // Tablas Operativas
    await db.exec(`
        CREATE TABLE IF NOT EXISTS remitos (
            nro_remito TEXT PRIMARY KEY,
            nombre_productor TEXT NOT NULL,
            origen_materia_prima TEXT,
            tipo_almacenamiento TEXT,
            modalidad_cobro TEXT,
            peso REAL NOT NULL
        );
    `);

    // Compatibilidad hacia el esquema actual usado por routes/remito.js.
    await ensureColumnExists(db, "remitos", "fecha_recepcion", "TEXT");
    await ensureColumnExists(db, "remitos", "productor", "TEXT");
    await ensureColumnExists(db, "remitos", "origen", "TEXT");
    await ensureColumnExists(db, "remitos", "estado", "TEXT");
    await ensureColumnExists(db, "remitos", "contenedor_tipo", "TEXT");
    await ensureColumnExists(db, "remitos", "contenedor_cantidad", "INTEGER");
    await ensureColumnExists(db, "remitos", "variedad", "TEXT");
    await ensureColumnExists(db, "remitos", "kg", "REAL");
    await ensureColumnExists(db, "remitos", "created_at", "TEXT");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS lotes (
            id_lote INTEGER PRIMARY KEY AUTOINCREMENT,
            blockchain_id INTEGER,
            peso_kg REAL,
            id_variedad INTEGER NOT NULL,
            id_etapa INTEGER NOT NULL DEFAULT 0,
            id_estado_validacion INTEGER NOT NULL DEFAULT 0,
            created_by INTEGER,
            FOREIGN KEY (id_variedad) REFERENCES variedades(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_etapa) REFERENCES etapas(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_estado_validacion) REFERENCES estados(id) ON DELETE RESTRICT,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
    `);

    // Migraciones para instalaciones existentes con esquema antiguo.
    await ensureColumnExists(db, "lotes", "codigo_lote", "TEXT");
    await ensureColumnExists(db, "lotes", "fecha_inicio", "TEXT");
    await ensureColumnExists(db, "lotes", "hash_integridad", "TEXT");
    await ensureColumnExists(db, "lotes", "tx_creacion_hash", "TEXT");

    // Si el esquema antiguo no tenia restriccion de unicidad, la agregamos por indice unico.
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_codigo_lote_unique ON lotes(codigo_lote);`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS tolva (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            peso_disponible REAL NOT NULL,
            hash_integridad TEXT NOT NULL
        );
    `);

    // Inicializar la tolva si está vacía
    const tolva = await db.get("SELECT * FROM tolva WHERE id = 1");
    if (!tolva) {
        const hashInicial = crypto.createHash('sha256').update(`TOLVA-0`).digest('hex');
        await db.run(
            `INSERT INTO tolva (id, peso_disponible, hash_integridad) VALUES (1, 0, ?)`,
            [hashInicial]
        );
    }

    dbInstance = db;
    return dbInstance;
}

// Función para obtener la instancia desde otros archivos
export function getDB() {
    if (!dbInstance) throw new Error("La base de datos no está inicializada.");
    return dbInstance;
}