import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import argon2 from "argon2";
import { getDB } from "../config/database.js";
import requireAuth from "../middleware/requireAuth.js";

dotenv.config();

const router = express.Router();
router.use(express.json());
router.use(cookieParser());
router.use(cors({ origin: "http://localhost:5173", credentials: true }));

/* Obtiene un valor de configuración del sistema a partir de su clave. */
async function getSetting(key) {
    const db = getDB();
    const row = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
    return row ? row.value : null;
}

/* Almacena o modifica un valor de configuración clave-valor en el sistema. */
async function setSetting(key, value) {
    const db = getDB();
    await db.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, value]
    );
}

/* Verifica si la aplicación ya fue inicializada (primera ejecución completada). */
async function isInitialized() {
    const initialized = await getSetting("initialized");
    if (initialized === "true") return true;

    // Compatibilidad retroactiva: si existe una instalación previa con admin + master_key_hash,
    // la marcamos como inicializada automáticamente para no forzar el flujo /init.
    const user = await getDB().get("SELECT dni FROM users WHERE dni='admin'");
    const master = await getSetting("master_key_hash");
    const legacyInitialized = !!user && !!master;

    if (legacyInitialized) {
        await setSetting("initialized", "true");
    }

    return legacyInitialized;
}

/* Genera una cadena criptográfica aleatoria para ser utilizada como token de sesión. */
function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

/* Elimina todas las sesiones activas en la base de datos y limpia la cookie del cliente. */
async function clearSessions(res) {
    await getDB().run("DELETE FROM sessions");
    res.clearCookie("session");
}

router.get("/status", async (req, res) => {
    res.json({ initialized: await isInitialized(), user: "admin" });
});

router.post("/init", async (req, res) => {
    if (await isInitialized()) return res.status(409).json({ error: "Ya inicializado" });

    const { masterKey, adminPassword } = req.body;
    if (!masterKey || !adminPassword) {
        return res.status(400).json({ error: "Faltan datos (masterKey, adminPassword)" });
    }

    const masterHash = await argon2.hash(String(masterKey));
    const passHash = await argon2.hash(String(adminPassword));
    const createdAt = new Date().toISOString();

    await getDB().run(
        "INSERT INTO users (dni, password_hash, created_at) VALUES ('admin', ?, ?) ON CONFLICT(dni) DO UPDATE SET password_hash=excluded.password_hash, created_at=excluded.created_at",
        [passHash, createdAt]
    );
    await setSetting("master_key_hash", masterHash);
    await setSetting("initialized", "true");

    await clearSessions(res);
    res.json({ ok: true });
});

router.post("/login", async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Falta password" });

    if (!(await isInitialized())) return res.status(400).json({ error: "No inicializado. Usá /auth/init" });

    const user = await getDB().get("SELECT * FROM users WHERE dni='admin'");
    const ok = await argon2.verify(user.password_hash, String(password));
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = createToken();
    const fechaCreacion = new Date().toISOString();

    await getDB().run("DELETE FROM sessions");
    await getDB().run(
        "INSERT INTO sessions (token, fecha_creacion) VALUES (?, ?)",
        [token, fechaCreacion]
    );

    res.cookie("session", token, { httpOnly: true, sameSite: "lax" });
    res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
    res.json({ ok: true, user: "admin" });
});

router.post("/logout", async (req, res) => {
    const token = req.cookies.session;
    if (token) await getDB().run("DELETE FROM sessions WHERE token = ?", [token]);
    res.clearCookie("session");
    res.json({ ok: true });
});

router.post("/recover", async (req, res) => {
    const { masterKey, newPassword } = req.body;
    if (!masterKey || !newPassword) {
        return res.status(400).json({ error: "Faltan datos (masterKey, newPassword)" });
    }

    const masterHash = await getSetting("master_key_hash");
    if (!masterHash) return res.status(400).json({ error: "No inicializado" });

    const ok = await argon2.verify(masterHash, String(masterKey));
    if (!ok) return res.status(401).json({ error: "Clave maestra incorrecta" });

    const newHash = await argon2.hash(String(newPassword));
    await getDB().run("UPDATE users SET password_hash=? WHERE dni='admin'", [newHash]);

    await clearSessions(res);
    res.json({ ok: true });
});

router.get("/debug-status", requireAuth, async (req, res) => {
    const user = await getDB().get("SELECT dni FROM users WHERE dni='admin'");
    const masterHashExists = await getSetting("master_key_hash");
    const sessionCount = await getDB().get("SELECT COUNT(*) as count FROM sessions");

    res.json({
        adminExists: !!user,
        masterKeyHashExists: !!masterHashExists,
        sessionCount: sessionCount?.count || 0,
        note: "Este endpoint es solo para debugging. Úsalo para verificar el estado de la BD."
    });
});

export default router;