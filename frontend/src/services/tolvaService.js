const TOLVA_ENDPOINT = import.meta.env.VITE_TOLVA_ENDPOINT || "/api/tolva";

async function request(path) {
    const res = await fetch(`${TOLVA_ENDPOINT}${path}`, {
        credentials: "include",
    });

    let data = null;
    try {
        data = await res.json();
    } catch {
        // Ignorar parseo cuando la respuesta no sea JSON.
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
    }

    return data;
}

export async function auditarTolva() {
    const response = await request("/auditar");
    if (!response.success) {
        throw new Error(response.error || response.message || "No se pudo auditar la tolva.");
    }

    return {
        pesoDisponible: response.data?.pesoDisponible ?? 0,
        hashIntegridad: response.data?.hashIntegridad || "",
        auditoria: response.auditoria || { estado: "DESCONOCIDO", esValido: null },
    };
}
