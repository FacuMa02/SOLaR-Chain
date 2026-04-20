const ANALITICAS_ENDPOINT = import.meta.env.VITE_ANALITICAS_ENDPOINT || "/api/analiticas";

export async function getAnaliticasDashboard() {
    const res = await fetch(ANALITICAS_ENDPOINT, {
        method: "GET",
        credentials: "include",
    });

    let data = null;
    try {
        data = await res.json();
    } catch {
        // Si backend devuelve una respuesta no-JSON, reportamos un error HTTP estándar.
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || data?.mensaje || `Error HTTP ${res.status}`);
    }

    return data;
}
