const express = require("express");
const Database = require("better-sqlite3");
const argon2 = require("argon2");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ==========================================
// 🛠️ INICIALIZACIÓN EXPRESS
// ==========================================
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// ==========================================
// 📦 CONFIGURACIÓN BASE DE DATOS (SQLite)
// ==========================================
const db = new Database("auth.db");

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

// ==========================================
// ⛓️ CONFIGURACIÓN BLOCKCHAIN
// ==========================================
const ETAPAS = ["RECEPCION", "MOLIENDA", "BATIDO", "CENTRIFUGADO", "DECANTACION", "ANALISIS", "ALMACENAMIENTO"];
const RESULTADOS = ["APROBADO", "OBSERVADO", "NO_CONFORME"];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Cargar ABI del contrato
const abiPath = path.join(__dirname, "../abis/Almazara.json");
const contractJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

console.log(`🔗 Conectado al contrato en: ${process.env.CONTRACT_ADDRESS}`);

// ==========================================
// 🔐 HELPERS: AUTENTICACIÓN Y BD
// ==========================================

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

function requireAuth(req, res, next) {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ error: "No autenticado" });

    const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    if (!s) return res.status(401).json({ error: "Sesión inválida" });

    next();
}

// ==========================================
// 🛠️ HELPERS: BLOCKCHAIN
// ==========================================

function parseBlockchainError(error) {
    if (error.reason) return error.reason;
    if (error.shortMessage) return error.shortMessage;

    if (error.data) {
        try {
            const decoded = contract.interface.parseError(error.data);
            if (decoded?.name === "TransicionInvalida") {
                const actual = Number(decoded.args[0]);
                const solicitada = Number(decoded.args[1]);
                return `Transición Inválida: No puedes saltar de ${ETAPAS[actual]} a ${ETAPAS[solicitada]}.`;
            }
        } catch (e) {
            /* Ignorar fallo de parseo */
        }
    }
    return "Error en validación del Smart Contract.";
}

// ==========================================
// 🏠 ENDPOINTS: HOME
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message: "Backend Solar Chain OK",
        endpoints: {
            auth: ["/auth/status", "/auth/init", "/auth/login", "/auth/logout", "/auth/recover", "/me"],
            blockchain: ["/crear-lote", "/avanzar-etapa", "/lote/:id"]
        }
    });
});

// ==========================================
// 🔐 ENDPOINTS: AUTENTICACIÓN
// ==========================================

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

// ==========================================
// ⛓️ ENDPOINTS: BLOCKCHAIN
// ==========================================

// ✅ CREAR LOTE
app.post("/crear-lote", async (req, res) => {
    const { remito } = req.body;

    try {
        const idTemporal = "TEMP-" + Date.now();
        console.log(`📝 Creando lote Remito: ${remito}...`);

        const tx = await contract.crearLote(remito, idTemporal, { gasLimit: 500000 });
        const receipt = await tx.wait();

        const eventLog = receipt.logs.find((log) => {
            try {
                return contract.interface.parseLog(log)?.name === "LoteCreado";
            } catch {
                return false;
            }
        });
        const parsedLog = contract.interface.parseLog(eventLog);
        const blockchainId = parsedLog.args[0].toString();

        res.json({
            success: true,
            message: "Lote creado en Blockchain exitosamente.",
            data: {
                idBlockchain: blockchainId,
                remito,
                txHash: tx.hash
            }
        });
    } catch (error) {
        console.error("❌ Error Crear Lote:", error);
        res.status(500).json({ success: false, error: parseBlockchainError(error) });
    }
});

// ✅ AVANZAR ETAPA
app.post("/avanzar-etapa", async (req, res) => {
    const { idLoteBlockchain, etapa, rendimiento, acidez, peroxidos } = req.body;

    try {
        console.log(`⚙️ Avanzando Lote ID ${idLoteBlockchain} a etapa ${ETAPAS[etapa]}...`);

        const tx = await contract.avanzarEtapa(
            idLoteBlockchain,
            etapa,
            rendimiento || 0,
            acidez || 0,
            peroxidos || 0,
            { gasLimit: 500000 }
        );

        const receipt = await tx.wait();

        const eventLog = receipt.logs.find((log) => {
            try {
                return contract.interface.parseLog(log)?.name === "AvanceEtapa";
            } catch {
                return false;
            }
        });
        const parsedLog = contract.interface.parseLog(eventLog);
        const resultadoCode = Number(parsedLog.args[2]);
        const motivo = parsedLog.args[3];

        res.json({
            success: true,
            txHash: tx.hash,
            resultado: RESULTADOS[resultadoCode],
            motivo: motivo,
            warning: resultadoCode > 0,
            message:
                resultadoCode > 0
                    ? `⚠️ Avanzado con observación: ${RESULTADOS[resultadoCode]} (${motivo})`
                    : "✅ Lote avanzado correctamente."
        });
    } catch (error) {
        const mensaje = parseBlockchainError(error);
        res.status(400).json({ success: false, error: mensaje });
    }
});

// ✅ GET LOTE
app.get("/lote/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const lote = await contract.getLote(id);

        const data = {
            id: lote.id.toString(),
            remito: lote.numeroRemito,
            etapa: {
                id: Number(lote.etapaActual),
                nombre: ETAPAS[Number(lote.etapaActual)]
            },
            calidad: {
                estado: RESULTADOS[Number(lote.estadoCalidad)],
                observaciones: lote.observaciones
            },
            kpis: {
                rendimiento: Number(lote.kpis.rendimiento),
                acidez: Number(lote.kpis.acidez),
                peroxidos: Number(lote.kpis.peroxidos)
            },
            fecha: new Date(Number(lote.timestamp) * 1000).toLocaleString()
        };

        res.json({ success: true, data });
    } catch (error) {
        if (error.code === "CALL_EXCEPTION" || error.message.includes("LoteNoExiste")) {
            console.warn(`⚠️ Cliente solicitó Lote ID ${id} (No existe)`);
            return res.status(404).json({
                success: false,
                error: "Lote no encontrado"
            });
        }

        console.error("❌ Error GET Lote:", error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
    }
});

// ==========================================
// 🚀 INICIO DEL SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Backend Solar Chain corriendo en http://localhost:${PORT}`);
    console.log(`   - Auth endpoints: /auth/*`);
    console.log(`   - Blockchain endpoints: /crear-lote, /avanzar-etapa, /lote/:id`);
});

module.exports = app;
