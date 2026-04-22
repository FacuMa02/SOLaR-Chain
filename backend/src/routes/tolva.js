import express from "express";
import crypto from "crypto";
import { getDB } from "../config/database.js";

const router = express.Router();

router.get("/", async (_req, res) => {
    const db = getDB();

    try {
        const tolva = await db.get("SELECT peso_disponible AS pesoDisponible, hash_integridad AS hashIntegridad FROM tolva WHERE id = 1");

        if (!tolva) {
            return res.status(404).json({ success: false, error: "Tolva no encontrada." });
        }

        return res.json({ success: true, data: tolva });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudo obtener el estado de la tolva." });
    }
});

router.get("/auditar", async (_req, res) => {
    const db = getDB();

    try {
        const tolva = await db.get("SELECT peso_disponible AS pesoDisponible, hash_integridad AS hashIntegridad FROM tolva WHERE id = 1");

        if (!tolva) {
            return res.status(404).json({ success: false, error: "Tolva no encontrada." });
        }

        const hashRecalculado = crypto
            .createHash("sha256")
            .update(`TOLVA-${tolva.pesoDisponible}`)
            .digest("hex");

        const esValido = hashRecalculado === tolva.hashIntegridad;

        return res.json({
            success: true,
            data: {
                pesoDisponible: tolva.pesoDisponible,
                hashIntegridad: tolva.hashIntegridad,
            },
            auditoria: {
                estado: esValido ? "INTEGRA" : "CORROMPIDA",
                esValido,
                detalles: {
                    hashAlmacenado: tolva.hashIntegridad,
                    hashRecalculado,
                },
            },
            mensaje: esValido
                ? "La integridad de la tolva es valida."
                : "Alerta: la integridad de la tolva no coincide.",
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: "No se pudo auditar la tolva." });
    }
});

export default router;
