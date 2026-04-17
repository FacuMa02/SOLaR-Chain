import * as api from "./apiClient";

export async function getRemitos() {
    const response = await api.get("/remitos");
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudieron obtener los remitos.");
    }
    return response.data || [];
}

export async function getRemitosCatalogos() {
    const response = await api.get("/remitos/catalogos");
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudieron obtener los catálogos de remitos.");
    }
    return response.data || { productores: [], origenes: [] };
}

export async function getRemitoById(id) {
    const response = await api.get(`/remitos/${id}`);
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudo obtener el remito.");
    }
    return response.data;
}

export async function createRemito(payload) {
    const response = await api.post("/remitos", payload);
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudo crear el remito.");
    }
    return response.data;
}