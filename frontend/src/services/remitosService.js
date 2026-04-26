const REMITOS_ENDPOINT = import.meta.env.VITE_REMITOS_ENDPOINT || "/api/remitos";

async function request(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`${REMITOS_ENDPOINT}${path}`, options);

    let data = null;
    try {
        data = await res.json();
    } catch {
        // Si la respuesta no es JSON no interrumpimos con parse error.
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
    }

    return data;
}

export async function getRemitos(page = 1, limit = 10) {
    const query = `?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`;
    const response = await request("GET", query);
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudieron obtener los remitos.");
    }

    return {
        data: response.data || [],
        page: response.page || 1,
        totalPages: response.totalPages || 1,
        total: response.total || 0,
        limit: response.limit || limit,
    };
}

export async function getRemitosCatalogos() {
    const response = await request("GET", "/catalogos");
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudieron obtener los catálogos de remitos.");
    }
    return response.data || { productores: [], origenes: [] };
}

export async function getRemitoById(id) {
    const response = await request("GET", `/${id}`);
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudo obtener el remito.");
    }
    return response.data;
}

export async function createRemito(payload) {
    const response = await request("POST", "", payload);
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudo crear el remito.");
    }
    return response.data;
}