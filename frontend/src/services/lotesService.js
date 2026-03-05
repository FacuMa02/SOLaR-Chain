const API_URL = "http://localhost:3001/lotes";

export async function getLotes() {
  const res = await fetch(API_URL, { 
    credentials: "include" 
  });
  if (!res.ok) throw new Error("Error al obtener los lotes");
  return await res.json();
}

export async function createLote(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include"
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Error al crear el lote");
  }
  return await res.json();
}

export async function updateLoteStageAsync(loteId, toStageIndex) {
  const res = await fetch(`${API_URL}/${loteId}/stage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageIndex: toStageIndex }),
    credentials: "include"
  });
  
  if (!res.ok) throw new Error("Error al actualizar la etapa");
  return true;
}

export async function getHistorial(search = "", page = 1, limit = 10) {
  const res = await fetch(`${API_URL}/historial?search=${search}&page=${page}&limit=${limit}`, {
    credentials: "include"
  });
  if (!res.ok) throw new Error("Error al obtener el historial");
  return await res.json();
}

export async function deleteLote(id, password) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "include"
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Error al eliminar el lote");
  }
  return await res.json();
}