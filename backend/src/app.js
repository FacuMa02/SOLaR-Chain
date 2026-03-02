import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./config/database.js";
import { initHistoryDB } from "./config/history_db.js";

import authRoutes from "./routes/auth.js";
import loteRoutes from "./routes/lote.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));


// 1. Inicializar AMBAS Bases de Datos en paralelo
Promise.all([initDB(), initHistoryDB()]).then(() => {

    // 2. Montar las rutas
    app.use("/api/auth", authRoutes);
    app.use("/api/lotes", loteRoutes);

    // 3. Arrancar el servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    });

}).catch((error) => {
    console.error("❌ Error crítico al arrancar las bases de datos:", error);
});