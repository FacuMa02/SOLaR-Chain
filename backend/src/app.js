import 'dotenv/config';
import express, { json } from "express";
import cors from "cors";
import { contract } from "./config/blockchain.js";
import { ethers } from "ethers";

const app = express();

// Middlewares
app.use(json()); // Para que entienda JSON en el body
app.use(cors());

// RUTA 1: Obtener información de un Lote (GET)
app.get("/lote/:id", async (req, res) => {

    const id = req.params.id;

    try {

        // Llamada al contrato (Lectura)
        const lote = await contract.getLote(id);

        // Formatear la respuesta (Solidity devuelve BigInts que JSON no entiende directo)
        const respuesta = {
            id: lote.id.toString(),
            nroRemito: lote.nroRemito, // 0, 1, 2...
            etapaActual: lote.etapaActual.toString(),
            creadoPor: lote.creadoPor,
            timestamp: new Date(Number(lote.timestamp) * 1000).toISOString()
        };

        res.json({ success: true, data: respuesta });
    } catch (error) {

        if (error.reason === "Lote no existe" || error.message.includes("Lote inexistente")) {

            // Log conciso (una sola línea)
            console.warn(`⚠️  [404] Consulta de lote no encontrado: ID ${id}`);

            return res.status(404).json({
                success: false,
                error: "El lote solicitado no existe en la Blockchain."
            });
        }

        console.error(`❌ [500] Error interno al leer ID ${id}:`, error.code || error.message);

        res.status(500).json({
            success: false,
            error: "Error de conexión con Blockchain"
        });
    }
});

// RUTA 2: Crear un Lote (POST)
app.post("/crear-lote", async (req, res) => {
    try {
        // 1. Recibimos los datos del formulario de Recepción
        const { nroRemito, kilos } = req.body;

        if (!nroRemito || !kilos) {
            return res.status(400).json({ error: "Faltan datos (codigo o kilos)" });
        }

        console.log(`Creando lote: ${nroRemito} (${kilos} kg)`);

        // 2. Enviamos a la Blockchain (Argumentos: string, uint)
        const tx = await contract.crearLote(nroRemito, kilos);

        await tx.wait();

        res.json({
            success: true,
            message: "Lote creado y anclado en Blockchain",
            txHash: tx.hash
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

//RUTA 3: Avanzar etapa
app.post("/avanzar-etapa", async (req, res) => {
    try {
        const { idLote, etapa, rendimiento, acidez, peroxidos } = req.body;

        const tx = await contract.avanzarEtapa(
            idLote,
            etapa,
            rendimiento,
            acidez,
            peroxidos
        );

        await tx.wait();
        res.send("Datos guardados en Blockchain");
    } catch (error) {
        res.status(500).json({ success: false, error: "Transacción inválida" })
    }
})


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
});