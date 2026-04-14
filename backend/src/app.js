import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./config/database.js";
import { initHistoryDB } from "./config/history_db.js";
import { assertBlockchainReady } from "./config/blockchain.js";
import authRoutes from "./routes/auth.js";
import loteRoutes from "./routes/lote.js";
import remitoRoutes from "./routes/remito.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

async function startServer() {
    try {
        // 1. INICIALIZAR LAS BASES DE DATOS PRIMERO
        console.log("Inicializando bases de datos...");
        await initDB();
        await initHistoryDB();
        console.log("Bases de datos listas.");

        console.log("Verificando conexión con Ganache y contrato...");
        await assertBlockchainReady();

        // 2. REGISTRAR LAS RUTAS DESPUÉS
        app.use('/api/auth', authRoutes); // Asegúrate de que el nombre coincida con tu importación
        app.use('/api/lotes', loteRoutes);
        app.use('/api/remitos', remitoRoutes);

        // 3. LEVANTAR EL SERVIDOR AL FINAL
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Servidor escuchando en el puerto ${PORT}`);
        });

    } catch (error) {
        console.error("Error crítico al arrancar el servidor:", error);
        process.exit(1); // Detiene la aplicación si la BD falla
    }
}

startServer();