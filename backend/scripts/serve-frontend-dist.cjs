const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "..", "..");
const FRONTEND_DIST = path.resolve(ROOT, "frontend", "dist");
const HOST = process.env.FRONTEND_HOST || "127.0.0.1";
const PORT = Number(process.env.FRONTEND_PORT || 5173);

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
};

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Error leyendo archivo.");
            return;
        }

        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
}

function resolvePathFromUrl(urlPath) {
    const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
    const normalized = path.normalize(cleanPath).replace(/^([.][.][/\\])+/, "");
    const candidate = path.join(FRONTEND_DIST, normalized);

    if (!candidate.startsWith(FRONTEND_DIST)) {
        return null;
    }

    return candidate;
}

if (!fs.existsSync(FRONTEND_DIST)) {
    console.error(`No existe ${FRONTEND_DIST}. Ejecuta build del frontend.`);
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const requested = resolvePathFromUrl(req.url);
    if (!requested) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ruta invalida");
        return;
    }

    let target = requested;

    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, "index.html");
    }

    if (!fs.existsSync(target)) {
        const spaFallback = path.join(FRONTEND_DIST, "index.html");
        sendFile(res, spaFallback);
        return;
    }

    sendFile(res, target);
});

server.listen(PORT, HOST, () => {
    console.log(`Frontend estatico escuchando en http://${HOST}:${PORT}`);
});
