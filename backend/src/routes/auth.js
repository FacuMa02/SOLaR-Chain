import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import argon2 from "argon2";
import { getDB } from "../config/database.js";

// initialize dotenv early, just in case
dotenv.config();

// express setup
const router = express.Router();
router.use(express.json());
router.use(cookieParser());
router.use(cors({ origin: "http://localhost:5173", credentials: true }));

// -------------------- helpers --------------------
async function getSetting(key) {
    const row = await getDB().get("SELECT value FROM settings WHERE key = ?", [key]);
    return row ? row.value : null;
}

async function setSetting(key, value) {
    await getDB().run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, value]
    );
}

async function isInitialized() {
    const user = await getDB().get("SELECT * FROM users WHERE username='admin'");
    const master = await getSetting("master_key_hash");
    return !!user && !!master;
}

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

async function clearSessions(res) {
    await getDB().run("DELETE FROM sessions");
    res.clearCookie("session");
}

async function requireAuth(req, res, next) {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ error: "No autenticado" });

    const s = await getDB().get("SELECT * FROM sessions WHERE token = ?", [token]);
    if (!s) return res.status(401).json({ error: "Sesión inválida" });

    next();
}

// -------------------- routes --------------------
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

    await getDB().run("INSERT INTO users (username, password_hash) VALUES ('admin', ?)", [passHash]);
    await setSetting("master_key_hash", masterHash);

    await clearSessions(res);
    res.json({ ok: true });
});

router.post("/login", async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Falta password" });

    if (!(await isInitialized())) return res.status(400).json({ error: "No inicializado. Usá /auth/init" });

    const user = await getDB().get("SELECT * FROM users WHERE username='admin'");
    const ok = await argon2.verify(user.password_hash, String(password));
    if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = createToken();
    await getDB().run("DELETE FROM sessions");
    await getDB().run("INSERT INTO sessions (token) VALUES (?)", [token]);

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
    await getDB().run("UPDATE users SET password_hash=? WHERE username='admin'", [newHash]);

    await clearSessions(res);
    res.json({ ok: true });
});

// ⚠️ ENDPOINT DE DEBUG: Ver estado de autenticación (solo desarrollo)
router.get("/debug-status", async (req, res) => {
    const user = await getDB().get("SELECT username FROM users WHERE username='admin'");
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
