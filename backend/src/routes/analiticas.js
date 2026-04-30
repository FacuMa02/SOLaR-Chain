import express from "express";
import { getDB } from "../config/database.js";
import { getHistoryDB } from "../config/history_db.js";

const router = express.Router();

function parseMetricas(detalles) {
    if (!detalles) {
        return { kgAceiteNeto: 0 };
    }

    try {
        const parsed = JSON.parse(detalles);
        return {
            kgAceiteNeto: Number(parsed?.kgAceiteNeto || 0),
        };
    } catch {
        return { kgAceiteNeto: 0 };
    }
}

// Helper para sacar la etiqueta "Sem X (Mes)" de una fecha automáticamente
function getWeekLabel(dateString) {
    if (!dateString) return "Sem ?";

    // 1. Convertimos el string de la base de datos a una fecha real
    const date = new Date(dateString);

    // 2. Sacamos el día del mes (del 1 al 31)
    const diaDelMes = date.getDate();

    // 3. Dividimos por 7 y redondeamos para arriba (resultado: 1, 2, 3, 4 o 5)
    const semanaDelMes = Math.ceil(diaDelMes / 7);

    // 4. Obtenemos el nombre corto del mes
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const mesCorto = meses[date.getMonth()];

    // 5. Devolvemos el string perfecto listo para la pantalla
    return `Sem ${semanaDelMes} (${mesCorto})`;
}

router.get("/", async (req, res) => {
    try {
        const db = getDB();
        const historyDb = getHistoryDB();

        // 1. OBTENER DATOS CRUDOS DE AMBAS BASES
        const remitos = await db.all("SELECT fecha_recepcion, kg FROM remitos");
        const lotes = await db.all("SELECT blockchain_id, peso_kg FROM lotes WHERE blockchain_id IS NOT NULL");
        const countLotesActivos = await db.get("SELECT COUNT(*) as total FROM lotes WHERE id_estado_validacion != 3 AND blockchain_id IS NOT NULL");

        const eventosTransicion = await historyDb.all(`
            SELECT blockchain_id, detalles, fecha_registro
            FROM historial_eventos
            WHERE id_tipo_evento = 2
            ORDER BY fecha_registro ASC
        `);

        // Extraer la MÁS RECIENTE métrica de extracción por lote
        const latestMetricasPorLote = {};
        eventosTransicion.forEach((evento) => {
            const metricas = parseMetricas(evento.detalles);
            if (metricas.kgAceiteNeto > 0) {
                latestMetricasPorLote[evento.blockchain_id] = {
                    kgAceiteNeto: metricas.kgAceiteNeto,
                    fecha_hora: evento.fecha_registro,
                };
            }
        });

        const transiciones = Object.entries(latestMetricasPorLote).map(([b_id, data]) => ({
            blockchain_id: Number(b_id),
            kgAceiteNeto: data.kgAceiteNeto,
            fecha_hora: data.fecha_hora,
        }));

        // 2. MATEMÁTICA PARA LOS KPIs (Tarjetas de resumen)
        const totalOliva = remitos.reduce((acc, r) => acc + r.kg, 0);

        // Armamos un "diccionario" con los kilos de cada lote para cruzarlos rápido con el historial
        const pesoPorLote = {};
        lotes.forEach(l => { pesoPorLote[l.blockchain_id] = l.peso_kg; });

        let totalAceite = 0;
        let sumaRendimiento = 0;
        let transicionesValidas = 0;

        transiciones.forEach(t => {
            const kgLote = pesoPorLote[t.blockchain_id] || 0;
            // Densidad promedio del aceite de oliva = 0.916 kg/L
            const litrosAceite = t.kgAceiteNeto / 0.916;
            
            t.litrosAceite = litrosAceite;
            totalAceite += litrosAceite;

            if (kgLote > 0) {
                const rendimiento = (t.kgAceiteNeto / kgLote) * 100;
                t.rendimiento = rendimiento;
                sumaRendimiento += rendimiento;
                transicionesValidas++;
            } else {
                t.rendimiento = 0;
            }
        });

        const rendimientoPromedio = transicionesValidas > 0 ? (sumaRendimiento / transicionesValidas) : 0;

        // 3. AGRUPAR DATOS POR SEMANA PARA LOS GRÁFICOS
        const datosSemanales = {};

        // Agrupar Oliva Ingresada
        remitos.forEach(r => {
            const sem = getWeekLabel(r.fecha_recepcion);
            if (!datosSemanales[sem]) datosSemanales[sem] = { semana: sem, oliva: 0, aceite: 0, sumRen: 0, countRen: 0 };
            datosSemanales[sem].oliva += r.kg;
        });

        // Agrupar Aceite y Rendimiento
        transiciones.forEach(t => {
            const sem = getWeekLabel(t.fecha_hora);
            if (!datosSemanales[sem]) datosSemanales[sem] = { semana: sem, oliva: 0, aceite: 0, sumRen: 0, countRen: 0 };

            datosSemanales[sem].aceite += t.litrosAceite;
            if (t.rendimiento > 0) {
                datosSemanales[sem].sumRen += t.rendimiento;
                datosSemanales[sem].countRen += 1;
            }
        });

        // Convertir el objeto agrupado en los arrays exactos que necesita Recharts
        const produccionSemanal = Object.values(datosSemanales).map(d => ({
            semana: d.semana,
            oliva: Number(d.oliva.toFixed(2)),
            aceite: Number(d.aceite.toFixed(2))
        }));

        const tendenciaRendimiento = Object.values(datosSemanales)
            .filter(d => d.countRen > 0) // Solo mostramos semanas donde hubo extracción
            .map(d => ({
                semana: d.semana,
                rendimiento: Number((d.sumRen / d.countRen).toFixed(2))
            }));

        // 4. ARMAR EL PAQUETE FINAL JSON
        const dashboardData = {
            kpis: {
                totalOliva: totalOliva.toLocaleString('es-AR'), // Formato con puntos de miles
                totalAceite: totalAceite.toLocaleString('es-AR', { maximumFractionDigits: 0 }),
                rendimientoPromedio: rendimientoPromedio.toFixed(1),
                lotesActivos: countLotesActivos?.total?.toString() || "0"
            },
            produccionSemanal,
            tendenciaRendimiento
        };

        res.json(dashboardData);
    } catch (error) {
        console.error("Error al calcular analíticas:", error);
        res.status(500).json({ mensaje: "Error interno del servidor al calcular analíticas" });
    }
});

export default router;