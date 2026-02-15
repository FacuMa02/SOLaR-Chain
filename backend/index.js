const express = require("express");
const Database = require("better-sqlite3");
const argon2 = require("argon2");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cookieParser());

// Permitimos el front (Vite)
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// --- DB ---
const db = new Database("auth.db");

// ÚNICO usuario fijo: admin
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

function isInitialized() {
  const user = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const master = getSetting("master_key_hash");
  return !!user && !!master;
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function clearSessions(res) {
  db.prepare("DELETE FROM sessions").run();
  res.clearCookie("session");
}

// ✅ HOME (solo para que no diga Cannot GET /)
app.get("/", (req, res) => {
  res.send("Backend OK. Probá /auth/status");
});

// ✅ STATUS
app.get("/auth/status", (req, res) => {
  res.json({ initialized: isInitialized(), user: "admin" });
});

// ✅ INIT (solo primera vez)
app.post("/auth/init", async (req, res) => {
  if (isInitialized()) return res.status(409).json({ error: "Ya inicializado" });

  const { masterKey, adminPassword } = req.body;
  if (!masterKey || !adminPassword) {
    return res.status(400).json({ error: "Faltan datos (masterKey, adminPassword)" });
  }

  const masterHash = await argon2.hash(String(masterKey));
  const passHash = await argon2.hash(String(adminPassword));

  db.prepare("INSERT INTO users (username, password_hash) VALUES ('admin', ?)").run(passHash);
  setSetting("master_key_hash", masterHash);

  clearSessions(res);
  res.json({ ok: true });
});

// ✅ LOGIN (solo password)
app.post("/auth/login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Falta password" });

  if (!isInitialized()) return res.status(400).json({ error: "No inicializado. Usá /auth/init" });

  const user = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const ok = await argon2.verify(user.password_hash, String(password));
  if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });

  const token = createToken();
  db.prepare("DELETE FROM sessions").run();
  db.prepare("INSERT INTO sessions (token) VALUES (?)").run(token);

  res.cookie("session", token, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!s) return res.status(401).json({ error: "Sesión inválida" });

  next();
}

// ✅ ME
app.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: "admin" });
});

// ✅ LOGOUT
app.post("/auth/logout", (req, res) => {
  const token = req.cookies.session;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.clearCookie("session");
  res.json({ ok: true });
});

// ✅ RECOVER (masterKey + newPassword)
app.post("/auth/recover", async (req, res) => {
  const { masterKey, newPassword } = req.body;
  if (!masterKey || !newPassword) {
    return res.status(400).json({ error: "Faltan datos (masterKey, newPassword)" });
  }

  const masterHash = getSetting("master_key_hash");
  if (!masterHash) return res.status(400).json({ error: "No inicializado" });

  const ok = await argon2.verify(masterHash, String(masterKey));
  if (!ok) return res.status(401).json({ error: "Clave maestra incorrecta" });

  const newHash = await argon2.hash(String(newPassword));
  db.prepare("UPDATE users SET password_hash=? WHERE username='admin'").run(newHash);

  clearSessions(res);
  res.json({ ok: true });
});

app.listen(3001, () => console.log("Auth API local en http://localhost:3001"));
