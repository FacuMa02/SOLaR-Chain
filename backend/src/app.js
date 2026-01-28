import 'dotenv/config';
import express, { json } from "express";
import cors from "cors";
import { contract } from "./config/blockchain.js";
import {ethers} from "ethers";

const app = express();

// Middlewares
app.use(json()); // Para que entienda JSON en el body
app.use(cors());

// RUTA 1: Obtener información de un Lote (GET)
app.get("/lote/:id", async (req, res) => {
    try {
        const id = req.params.id;
        
        // Llamada al contrato (Lectura)
        const lote = await contract.getLote(id);
        
        // Formatear la respuesta (Solidity devuelve BigInts que JSON no entiende directo)
        const respuesta = {
            id: lote.id.toString(),
            estado: lote.estado.toString(), // 0, 1, 2...
            etapa: lote.etapa.toString(),
            hashMetadata: lote.hashMetadata,
            creadoPor: lote.creadoPor,
            fecha: new Date(Number(lote.fechaCreacion) * 1000).toISOString()
        };

        res.json({ success: true, data: respuesta });
    } catch (error) {
        console.error("Error al leer lote:", error);
        res.status(500).json({ success: false, error: "Error al leer de Blockchain" });
    }
});

// RUTA 2: Crear un Lote (POST)
app.post("/crear-lote", async (req, res) => {
    try {
        const { estado, hashMetadata } = req.body; // El frontend nos manda esto

        // Conversión básica para el hash si viene como string simple
        // (En producción validarías que sea un bytes32 válido)
        const hashFormat = hashMetadata.startsWith("0x") ? hashMetadata : ethers.id(hashMetadata);

        console.log("Transacción iniciada...");
        
        // Llamada al contrato (Escritura)
        const tx = await contract.crearLote(estado, hashFormat);
        
        // Esperar confirmación
        await tx.wait();

        res.json({ 
            success: true, 
            message: "Lote creado correctamente", 
            txHash: tx.hash 
        });

    } catch (error) {
        console.error("Error creando lote:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
});