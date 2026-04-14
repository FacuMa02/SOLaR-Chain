import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";

let dbInstance = null;

function buildCoalesceExpr(existingColumnNames, candidateColumns, fallbackSql) {
    const available = candidateColumns.filter((col) => existingColumnNames.has(col));
    if (available.length === 0) {
        return fallbackSql;
    }
    return `COALESCE(${available.join(", ")}, ${fallbackSql})`;
}

async function normalizeRemitosTable(db) {
    const columns = await db.all("PRAGMA table_info(remitos)");
    const columnNames = new Set(columns.map((col) => col.name));

    const normalizedColumns = [
        "nro_remito",
        "fecha_recepcion",
        "productor",
        "origen",
        "estado",
        "contenedor_tipo",
        "contenedor_cantidad",
        "variedad",
        "kg",
        "created_at",
    ];

    const legacyColumns = [
        "nombre_productor",
        "origen_materia_prima",
        "tipo_almacenamiento",
        "modalidad_cobro",
        "peso",
    ];

    const hasAllNormalized = normalizedColumns.every((col) => columnNames.has(col));
    const hasLegacy = legacyColumns.some((col) => columnNames.has(col));

    if (hasAllNormalized && !hasLegacy) {
        return;
    }

    const nroRemitoExpr = buildCoalesceExpr(columnNames, ["nro_remito"], "('REM-LEGACY-' || rowid)");
    const fechaExpr = buildCoalesceExpr(columnNames, ["fecha_recepcion"], "NULL");
    const productorExpr = buildCoalesceExpr(columnNames, ["productor", "nombre_productor"], "''");
    const origenExpr = buildCoalesceExpr(columnNames, ["origen", "origen_materia_prima"], "NULL");
    const estadoExpr = buildCoalesceExpr(columnNames, ["estado", "modalidad_cobro"], "NULL");
    const contenedorTipoExpr = buildCoalesceExpr(columnNames, ["contenedor_tipo", "tipo_almacenamiento"], "NULL");
    const contenedorCantidadExpr = buildCoalesceExpr(columnNames, ["contenedor_cantidad"], "NULL");
    const variedadExpr = buildCoalesceExpr(columnNames, ["variedad"], "NULL");
    const kgExpr = buildCoalesceExpr(columnNames, ["kg", "peso"], "0");
    const createdAtExpr = buildCoalesceExpr(columnNames, ["created_at"], "datetime('now')");

    await db.exec("BEGIN TRANSACTION");
    try {
        await db.exec(`
            CREATE TABLE remitos_normalized (
                nro_remito TEXT PRIMARY KEY,
                fecha_recepcion TEXT,
                productor TEXT NOT NULL,
                origen TEXT,
                estado TEXT,
                contenedor_tipo TEXT,
                contenedor_cantidad INTEGER,
                variedad TEXT,
                kg REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        `);

        await db.exec(`
            INSERT INTO remitos_normalized (
                nro_remito,
                fecha_recepcion,
                productor,
                origen,
                estado,
                contenedor_tipo,
                contenedor_cantidad,
                variedad,
                kg,
                created_at
            )
            SELECT
                ${nroRemitoExpr},
                ${fechaExpr},
                ${productorExpr},
                ${origenExpr},
                ${estadoExpr},
                ${contenedorTipoExpr},
                ${contenedorCantidadExpr},
                ${variedadExpr},
                ${kgExpr},
                ${createdAtExpr}
            FROM remitos;
        `);

        await db.exec("DROP TABLE remitos");
        await db.exec("ALTER TABLE remitos_normalized RENAME TO remitos");
        await db.exec("COMMIT");
        console.log("Migracion aplicada: remitos normalizado sin columnas redundantes.");
    } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}

async function normalizeLotesTable(db) {
    const columns = await db.all("PRAGMA table_info(lotes)");
    const columnNames = new Set(columns.map((col) => col.name));

    const normalizedColumns = [
        "id_lote",
        "blockchain_id",
        "codigo_lote",
        "fecha_inicio",
        "peso_kg",
        "id_variedad",
        "id_etapa",
        "id_estado_validacion",
        "hash_integridad",
        "tx_creacion_hash",
        "created_by",
    ];

    const legacyColumns = ["id", "codigo", "fecha_recepcion", "kg", "peso", "id_estado", "estado"];

    const hasAllNormalized = normalizedColumns.every((col) => columnNames.has(col));
    const hasLegacy = legacyColumns.some((col) => columnNames.has(col));

    if (hasAllNormalized && !hasLegacy) {
        return;
    }

    const idLoteExpr = buildCoalesceExpr(columnNames, ["id_lote", "id"], "rowid");
    const blockchainIdExpr = buildCoalesceExpr(columnNames, ["blockchain_id"], "NULL");
    const codigoExpr = buildCoalesceExpr(columnNames, ["codigo_lote", "codigo"], "('LOTE-LEGACY-' || rowid)");
    const fechaInicioExpr = buildCoalesceExpr(columnNames, ["fecha_inicio", "fecha_recepcion"], "NULL");
    const pesoExpr = buildCoalesceExpr(columnNames, ["peso_kg", "kg", "peso"], "0");
    const idVariedadExpr = buildCoalesceExpr(columnNames, ["id_variedad"], "1");
    const idEtapaExpr = buildCoalesceExpr(columnNames, ["id_etapa"], "0");
    const idEstadoExpr = buildCoalesceExpr(columnNames, ["id_estado_validacion", "id_estado"], "0");
    const hashExpr = buildCoalesceExpr(columnNames, ["hash_integridad"], "NULL");
    const txHashExpr = buildCoalesceExpr(columnNames, ["tx_creacion_hash"], "NULL");
    const createdByExpr = buildCoalesceExpr(columnNames, ["created_by"], "NULL");

    await db.exec("BEGIN TRANSACTION");
    try {
        await db.exec(`
            CREATE TABLE lotes_normalized (
                id_lote INTEGER PRIMARY KEY AUTOINCREMENT,
                blockchain_id INTEGER,
                codigo_lote TEXT NOT NULL UNIQUE,
                fecha_inicio TEXT,
                peso_kg REAL,
                id_variedad INTEGER NOT NULL,
                id_etapa INTEGER NOT NULL DEFAULT 0,
                id_estado_validacion INTEGER NOT NULL DEFAULT 0,
                hash_integridad TEXT,
                tx_creacion_hash TEXT,
                created_by INTEGER,
                FOREIGN KEY (id_variedad) REFERENCES variedades(id) ON DELETE RESTRICT,
                FOREIGN KEY (id_etapa) REFERENCES etapas(id) ON DELETE RESTRICT,
                FOREIGN KEY (id_estado_validacion) REFERENCES estados(id) ON DELETE RESTRICT,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            );
        `);

        await db.exec(`
            INSERT INTO lotes_normalized (
                id_lote,
                blockchain_id,
                codigo_lote,
                fecha_inicio,
                peso_kg,
                id_variedad,
                id_etapa,
                id_estado_validacion,
                hash_integridad,
                tx_creacion_hash,
                created_by
            )
            SELECT
                ${idLoteExpr},
                ${blockchainIdExpr},
                ${codigoExpr},
                ${fechaInicioExpr},
                ${pesoExpr},
                ${idVariedadExpr},
                ${idEtapaExpr},
                ${idEstadoExpr},
                ${hashExpr},
                ${txHashExpr},
                ${createdByExpr}
            FROM lotes;
        `);

        await db.exec("DROP TABLE lotes");
        await db.exec("ALTER TABLE lotes_normalized RENAME TO lotes");
        await db.exec("COMMIT");
        console.log("Migracion aplicada: lotes normalizado sin columnas redundantes.");
    } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}

export async function initDB() {
    if (dbInstance) return dbInstance;

    const db = await open({
        filename: "./produccion.sqlite",
        driver: sqlite3.Database
    });

    console.log("Base de datos SQLite inicializada.");

    await db.exec(`PRAGMA foreign_keys = ON;`);

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

    await db.exec(`
        CREATE TABLE IF NOT EXISTS variedades (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO variedades (id, nombre) VALUES
        (1, 'Arauco'), (2, 'Arbequina'), (3, 'Hojiblanca'), (4, 'Picual'), (5, 'Manzanilla');
    `);

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
        CREATE TABLE IF NOT EXISTS estados (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO estados (id, nombre) VALUES
        (0, 'APROBADO'), (1, 'OBSERVADO'), (2, 'BLOQUEADO'), (3, 'CANCELADO');
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS estados_validacion (
            id INTEGER PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE
        );
        INSERT OR IGNORE INTO estados_validacion (id, nombre) VALUES
        (0, 'APROBADO'), (1, 'OBSERVADO'), (2, 'BLOQUEADO'), (3, 'CANCELADO');
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS remitos (
            nro_remito TEXT PRIMARY KEY,
            fecha_recepcion TEXT,
            productor TEXT NOT NULL,
            origen TEXT,
            estado TEXT,
            contenedor_tipo TEXT,
            contenedor_cantidad INTEGER,
            variedad TEXT,
            kg REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

    await normalizeRemitosTable(db);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS lotes (
            id_lote INTEGER PRIMARY KEY AUTOINCREMENT,
            blockchain_id INTEGER,
            codigo_lote TEXT NOT NULL UNIQUE,
            fecha_inicio TEXT,
            peso_kg REAL,
            id_variedad INTEGER NOT NULL,
            id_etapa INTEGER NOT NULL DEFAULT 0,
            id_estado_validacion INTEGER NOT NULL DEFAULT 0,
            hash_integridad TEXT,
            tx_creacion_hash TEXT,
            created_by INTEGER,
            FOREIGN KEY (id_variedad) REFERENCES variedades(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_etapa) REFERENCES etapas(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_estado_validacion) REFERENCES estados(id) ON DELETE RESTRICT,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );
    `);

    await normalizeLotesTable(db);

    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_codigo_lote_unique ON lotes(codigo_lote);`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS tolva (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            peso_disponible REAL NOT NULL,
            hash_integridad TEXT NOT NULL
        );
    `);

    const tolva = await db.get("SELECT * FROM tolva WHERE id = 1");
    if (!tolva) {
        const hashInicial = crypto.createHash("sha256").update("TOLVA-0").digest("hex");
        await db.run(
            `INSERT INTO tolva (id, peso_disponible, hash_integridad) VALUES (1, 0, ?)`,
            [hashInicial]
        );
    }

    dbInstance = db;
    return dbInstance;
}

export function getDB() {
    if (!dbInstance) throw new Error("La base de datos no esta inicializada.");
    return dbInstance;
}
