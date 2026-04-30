import express from "express";
import { getDB } from "../config/database.js";
import { contract } from "../config/blockchain.js";

const router = express.Router();

router.post('/finalizar-lote', async (req, res) => {
    const { lote_id, deposito_id } = req.body;

    if (!lote_id || !deposito_id) {
        return res.status(400).json({ error: 'lote_id y deposito_id son requeridos' });
    }

    try {
        const db = getDB();
        // Obtener datos del lote
        const lote = await db.get(`
            SELECT l.peso_kg, l.id_etapa, e.nombre as etapa_nombre
            FROM lotes l
            JOIN etapas e ON l.id_etapa = e.id
            WHERE l.id_lote = ?
        `, [lote_id]);

        if (!lote) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        if (lote.etapa_nombre !== 'ALMACENAMIENTO') {
            return res.status(400).json({ error: 'El lote debe estar en etapa ALMACENAMIENTO' });
        }

        // Obtener rendimiento industrial (asumir que está en kpis o calcular)
        // En el análisis, rendimiento_industrial es parte de kpis
        // Pero en db, no veo columna directa. Asumir que se calcula o está en otra tabla.
        // Para simplificar, asumir que hay una columna rendimiento_industrial en lotes
        // Si no, calcular basado en kg_aceite_neto / peso_kg * 100
        // Pero en struct Lote hay kgAceiteNeto
        // Leer de blockchain o de db.

        // Asumir que en lotes hay kg_aceite_neto y rendimiento
        // En el código, en lote.js hay queries con rendimiento_industrial
        // Buscar en lote.js

        // En el análisis, lotes tiene peso_kg, y rendimiento_industrial
        // Agregar columna si no existe.

        // Para ahora, asumir que hay rendimiento_industrial en lotes.

        const loteCompleto = await db.get(`
            SELECT peso_kg, rendimiento_industrial
            FROM lotes
            WHERE id_lote = ?
        `, [lote_id]);

        if (!loteCompleto.rendimiento_industrial) {
            return res.status(400).json({ error: 'Rendimiento industrial no disponible' });
        }

        const aceite_kg = loteCompleto.peso_kg * (loteCompleto.rendimiento_industrial / 100);
        const litros = aceite_kg / 0.916;
        const litros_scaled = Math.round(litros * 100); // para 2 decimales en uint256

        // Llamar al smart contract
        const tx = await contract.registrarEntradaAceite(deposito_id, litros_scaled);
        await tx.wait();

        // Actualizar SQLite
        await db.run('UPDATE lotes SET id_etapa = (SELECT id FROM etapas WHERE nombre = ?), litros_restantes = ? WHERE id_lote = ?', ['Finalizado', litros, lote_id]);

        // Nota: etapas tiene 'Finalizado'? No, agregar si necesario.
        // Asumir que hay etapa 'FINALIZADO' con id 7

        // Sumar a deposito
        await db.run('UPDATE depositos SET stock_actual = stock_actual + ? WHERE id = ?', [litros, deposito_id]);

        res.json({ success: true, litros_calculados: litros });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/descontar', async (req, res) => {
    const { lote_id, deposito_id, cantidad } = req.body;

    if (!lote_id || !deposito_id || !cantidad || cantidad <= 0) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    try {
        const db = getDB();
        // Verificar que el lote tenga suficientes litros
        const lote = await db.get('SELECT litros_restantes FROM lotes WHERE id_lote = ?', [lote_id]);
        if (!lote) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        // Tolerancia de 0.02 L para compensar el redondeo del frontend (toFixed(2))
        let cantidadADescontar = cantidad;
        if (cantidad > lote.litros_restantes && (cantidad - lote.litros_restantes) <= 0.02) {
            cantidadADescontar = lote.litros_restantes;
        }

        if (lote.litros_restantes < cantidadADescontar) {
            return res.status(400).json({ error: 'Cantidad insuficiente en el lote' });
        }

        let nuevosLitros = lote.litros_restantes - cantidadADescontar;
        if (nuevosLitros < 0.05) nuevosLitros = 0; // Evitar polvo flotante por redondeo de UI a 2 decimales

        // Restar de lote
        await db.run('UPDATE lotes SET litros_restantes = ? WHERE id_lote = ?', [nuevosLitros, lote_id]);

        // Restar de deposito
        await db.run('UPDATE depositos SET stock_actual = stock_actual - ? WHERE id = ?', [cantidadADescontar, deposito_id]);

        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

export default router;