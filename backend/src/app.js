import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./config/database.js";

// Importamos los enrutadores (Rutas)
import authRoutes from "./routes/auth.js";
import loteRoutes from "./routes/lote.js";

dotenv.config();
const app = express();
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));
app.use(express.json());

// 1. Inicializar Base de Datos primero
initDB().then(() => {

    // 2. Montar las rutas (Con prefijos limpios)
    app.use("/api/auth", authRoutes);
    app.use("/api/lotes", loteRoutes);

    // 3. Arrancar el servidor
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
        console.log(`🔑 Rutas Auth montadas en: /api/auth`);
        console.log(`🏭 Rutas Lotes montadas en: /api/lotes`);
    });

}).catch((error) => {
    console.error("❌ Error crítico al arrancar la base de datos:", error);
});