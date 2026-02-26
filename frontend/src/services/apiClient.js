// same default as authService; include the /api prefix so callers can use
// just "/auth/..." or "/lotes/...". port 3001 matches what the backend prints
// when it starts (see logs).
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${path}`, options);

    let data = null;
    try {
        data = await res.json();
    } catch {
        // Si el backend devuelve HTML (404), esto evita que se rompa
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
    }

    return data;
}

export function get(path) {
    return request("GET", path);
}

export function post(path, body) {
    return request("POST", path, body);
}

export function put(path, body) {
    return request("PUT", path, body);
}

export function del(path) {
    return request("DELETE", path);
}

export { API_BASE };
