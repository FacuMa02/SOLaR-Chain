import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";

const router = express.Router();

const REMITO_UTC_OFFSET_HOURS = -3;

function formatDateTimeAtUtcOffset(date, offsetHours) {
    const shifted = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
    const yyyy = String(shifted.getUTCFullYear());
    const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(shifted.getUTCDate()).padStart(2, "0");
    const hh = String(shifted.getUTCHours()).padStart(2, "0");
    const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
    const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}-${month}-${dd}T${hh}:${mm}:${ss}`;
}

function getNowAtUtcOffset(offsetHours) {
    return formatDateTimeAtUtcOffset(new Date(), offsetHours);
}

function normalizeFechaRecepcion(fechaRecepcion) {
    const nowAtUtcOffset = getNowAtUtcOffset(REMITO_UTC_OFFSET_HOURS);
    const [, hh, mm, ss] = nowAtUtcOffset.match(/T(\d{2}):(\d{2}):(\d{2})$/) || [];

    const raw = String(fechaRecepcion || "").trim();
    if (!raw) {
        return nowAtUtcOffset;
    }

    const explicitDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (explicitDateMatch) {
        return `${explicitDateMatch[1]}T${hh}:${mm}:${ss}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return nowAtUtcOffset;
    }

    const yyyy = String(parsed.getFullYear());
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${month}-${dd}T${hh}:${mm}:${ss}`;
}

router.get("/", async (req, res) => {
    const db = getDB();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Number.parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    try {
        const totalRow = await db.get("SELECT COUNT(*) AS total FROM remitos");
        const total = Number(totalRow?.total || 0);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const remitos = await db.all(
            `SELECT
                rowid AS id,
                nro_remito AS nroRemito,
				fecha_recepcion AS fechaRecepcion,
				productor,
				origen,
				estado,
				contenedor_tipo AS contenedorTipo,
				contenedor_cantidad AS contenedorCantidad,
				variedad,
				kg,
				created_at AS createdAt
			FROM remitos
            ORDER BY fecha_recepcion DESC, id DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return res.json({ success: true, data: remitos, page, limit, total, totalPages });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudieron obtener los remitos." });
    }
});

router.get("/catalogos", async (_req, res) => {
    const db = getDB();

    try {
        const [productoresRows, origenesRows] = await Promise.all([
            db.all(
                `SELECT DISTINCT TRIM(productor) AS value
                FROM remitos
                WHERE TRIM(COALESCE(productor, '')) <> ''
                ORDER BY value COLLATE NOCASE ASC`
            ),
            db.all(
                `SELECT DISTINCT TRIM(origen) AS value
                FROM remitos
                WHERE TRIM(COALESCE(origen, '')) <> ''
                ORDER BY value COLLATE NOCASE ASC`
            ),
        ]);

        return res.json({
            success: true,
            data: {
                productores: productoresRows.map((row) => row.value),
                origenes: origenesRows.map((row) => row.value),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudieron obtener los catálogos de remitos." });
    }
});

router.get("/:id", async (req, res) => {
    const db = getDB();
    const remitoId = Number(req.params.id);

    if (!Number.isInteger(remitoId) || remitoId <= 0) {
        return res.status(400).json({ success: false, error: "El id del remito es inválido." });
    }

    try {
        const remito = await db.get(
            `SELECT
                rowid AS id,
                nro_remito AS nroRemito,
				fecha_recepcion AS fechaRecepcion,
				productor,
				origen,
				estado,
				contenedor_tipo AS contenedorTipo,
				contenedor_cantidad AS contenedorCantidad,
				variedad,
				kg,
				created_at AS createdAt
			FROM remitos
			WHERE rowid = ?`,
            [remitoId]
        );

        if (!remito) {
            return res.status(404).json({ success: false, error: "Remito no encontrado." });
        }

        return res.json({ success: true, data: remito });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudo obtener el remito." });
    }
});

router.post("/", async (req, res) => {
    const db = getDB();
    const {
        nroRemito,
        fechaRecepcion,
        productor,
        origen,
        estado,
        contenedorTipo,
        contenedorCantidad,
        variedad,
        kg,
    } = req.body;

    const nroRemitoNum = Number.parseInt(nroRemito, 10);
    if (!Number.isInteger(nroRemitoNum) || nroRemitoNum <= 0) {
        return res.status(400).json({ success: false, error: "El número de remito debe ser un entero mayor a 0." });
    }
    const currentYear = new Date().getFullYear();
    const nroRemitoFull = `REM-${currentYear}-${String(nroRemitoNum).padStart(3, "0")}`;

    const kgValue = Number(kg);
    const contenedorCantidadValue = Number(contenedorCantidad);

    if (!nroRemito) {
        return res.status(400).json({ success: false, error: "El número de remito es obligatorio." });
    }

    if (!fechaRecepcion || !String(productor || "").trim() || !String(origen || "").trim() || !String(estado || "").trim()) {
        return res.status(400).json({ success: false, error: "Faltan campos obligatorios del remito." });
    }

    if (!String(contenedorTipo || "").trim() || !String(variedad || "").trim()) {
        return res.status(400).json({ success: false, error: "Debe indicar tipo de contenedor y variedad." });
    }

    if (!Number.isFinite(contenedorCantidadValue) || contenedorCantidadValue <= 0) {
        return res.status(400).json({ success: false, error: "La cantidad de contenedores debe ser mayor a 0." });
    }

    if (!Number.isFinite(kgValue) || kgValue <= 0) {
        return res.status(400).json({ success: false, error: "El peso en KG debe ser mayor a 0." });
    }

    try {
        const existing = await db.get("SELECT rowid FROM remitos WHERE nro_remito = ?", [nroRemitoFull]);
        if (existing) {
            return res.status(409).json({ success: false, error: `Ya existe un remito con el número ${nroRemitoFull}.` });
        }

        await db.exec("BEGIN TRANSACTION");

        const createdAt = getNowAtUtcOffset(REMITO_UTC_OFFSET_HOURS);
        const fechaRecepcionNormalized = normalizeFechaRecepcion(fechaRecepcion);

        const insertResult = await db.run(
            `INSERT INTO remitos (
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
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
                nroRemitoFull,
                fechaRecepcionNormalized,
                String(productor).trim(),
                String(origen).trim(),
                String(estado).trim(),
                String(contenedorTipo).trim(),
                contenedorCantidadValue,
                String(variedad).trim(),
                kgValue,
                createdAt,
            ]
        );

        const tolva = await db.get("SELECT peso_disponible FROM tolva WHERE id = 1");
        const stockActual = Number(tolva?.peso_disponible || 0);
        const nuevoStockTolva = stockActual + kgValue;
        const hashTolva = crypto.createHash("sha256").update(`TOLVA-${nuevoStockTolva}`).digest("hex");

        await db.run(
            "UPDATE tolva SET peso_disponible = ?, hash_integridad = ? WHERE id = 1",
            [nuevoStockTolva, hashTolva]
        );

        await db.exec("COMMIT");

        const remito = await db.get(
            `SELECT
                rowid AS id,
                nro_remito AS nroRemito,
				fecha_recepcion AS fechaRecepcion,
				productor,
				origen,
				estado,
				contenedor_tipo AS contenedorTipo,
				contenedor_cantidad AS contenedorCantidad,
				variedad,
				kg,
				created_at AS createdAt
			FROM remitos
			WHERE rowid = ?`,
            [insertResult.lastID]
        );

        return res.status(201).json({
            success: true,
            data: {
                remito,
                tolva: {
                    pesoDisponible: nuevoStockTolva,
                    hashIntegridad: hashTolva,
                },
            },
        });
    } catch (error) {
        try {
            await db.exec("ROLLBACK");
        } catch {
            // Ignorar rollback si la transacción no quedó abierta.
        }
        return res.status(500).json({ success: false, error: "No se pudo crear el remito." });
    }
});

export default router;

