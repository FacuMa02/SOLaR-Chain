import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";

const router = express.Router();

router.get("/", async (_req, res) => {
    const db = getDB();

    try {
        const remitos = await db.all(
            `SELECT
                rowid AS id,
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
			ORDER BY id DESC`
        );

        return res.json({ success: true, data: remitos });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudieron obtener los remitos." });
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
        fechaRecepcion,
        productor,
        origen,
        estado,
        contenedorTipo,
        contenedorCantidad,
        variedad,
        kg,
    } = req.body;

    const kgValue = Number(kg);
    const contenedorCantidadValue = Number(contenedorCantidad);

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
        await db.exec("BEGIN TRANSACTION");

        const nroRemito = `REM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const insertResult = await db.run(
            `INSERT INTO remitos (
				nro_remito,
				nombre_productor,
				origen_materia_prima,
				tipo_almacenamiento,
				modalidad_cobro,
				peso,
				fecha_recepcion,
				productor,
				origen,
				estado,
				contenedor_tipo,
				contenedor_cantidad,
				variedad,
				kg
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
                nroRemito,
                String(productor).trim(),
                String(origen).trim(),
                String(contenedorTipo).trim(),
                String(estado).trim(),
                kgValue,
                fechaRecepcion,
                String(productor).trim(),
                String(origen).trim(),
                String(estado).trim(),
                String(contenedorTipo).trim(),
                contenedorCantidadValue,
                String(variedad).trim(),
                kgValue,
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

