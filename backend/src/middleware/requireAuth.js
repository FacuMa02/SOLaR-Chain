import { getDB } from "../config/database.js";

export default async function requireAuth(req, res, next) {
    const token = req.cookies?.session;

    if (!token) {
        return res.status(401).json({ error: "UNAUTHORIZED: no autenticado" });
    }

    try {
        const session = await getDB().get("SELECT token FROM sessions WHERE token = ?", [token]);
        if (!session) {
            return res.status(401).json({ error: "UNAUTHORIZED: sesión inválida" });
        }
        return next();
    } catch {
        return res.status(500).json({ error: "Error interno de autenticación" });
    }
}