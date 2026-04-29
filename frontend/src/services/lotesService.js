import { STAGES } from "../data/stages";
const LOTES_ENDPOINT = import.meta.env.VITE_LOTES_ENDPOINT || "/api/lotes";
const KEY = "solar_lotes_v1";

const FAIL_RATE = 0.25; // 25%
const MIN_DELAY = 450;
const MAX_DELAY = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(lotes) {
  localStorage.setItem(KEY, JSON.stringify(lotes));
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${LOTES_ENDPOINT}${path}`, options);

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Evita fallos de parseo JSON cuando la respuesta no viene en JSON.
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
  }

  return data;
}

function ensureSeed() {
  const lotes = load();
  if (lotes.length > 0) return lotes;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const iso = `${yyyy}-${mm}-${dd}`;

  const seeded = [
    {
      id: crypto.randomUUID(),
      codigo: `LOT-${yyyy}-001`,
      fechaRecepcion: iso,
      productor: "Finca Don José",
      origen: "Chilecito",
      estado: "buena",
      contenedorTipo: "Cajones",
      contenedorCantidad: 9,
      variedad: "Mezcla",
      kg: 1200.5,
      stageIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      codigo: `LOT-${yyyy}-002`,
      fechaRecepcion: iso,
      productor: "Productor La Costa",
      origen: "Arauco",
      estado: "regular",
      contenedorTipo: "Bolsas",
      contenedorCantidad: 12,
      variedad: "Arauco",
      kg: 860,
      stageIndex: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  save(seeded);
  return seeded;
}

export function getLotes() {
  return ensureSeed();
}

// --- nuevos helpers que usan el backend ---

/**
 * Obtiene el tablero real desde el servidor (ruta /tablero).
 * Convierte los registros a la forma que espera el frontend.
 */
export async function fetchTablero() {
  const response = await request("GET", "/tablero");
  if (!response.success) {
    throw new Error(response.error || "Error al cargar el tablero");
  }

  // cada lote viene con: blockchain_id, codigo_lote, variedad, peso_kg, etapa_actual, estado
  // nosotros necesitamos: id, codigo, variedad, kg, stageIndex, estado
  return response.data.map((l) => {
    // backend may send etapa_index as number or numeric string, otherwise fallback to etapa_actual
    let stageIndex = Number(l.etapa_index);
    if (Number.isNaN(stageIndex)) {
      const etapaActual = String(l.etapa_actual || "").toLowerCase();
      const normalize = (text) =>
        String(text)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

      const etapaNormalizada = normalize(etapaActual);
      const idx = STAGES.findIndex((s) => normalize(s) === etapaNormalizada);
      stageIndex = idx === -1 ? 0 : idx;
    }

    return {
      id: l.id_lote,
      codigo: l.codigo_lote,
      fechaInicio: l.fecha_inicio,
      variedad: l.variedad,
      kg: l.peso_kg,
      calidad: l.calidad || null,
      kgAceiteNeto: l.kg_aceite_neto,
      rendimiento: l.rendimiento,
      acidez: l.acidez,
      peroxidos: l.peroxidos,
      etapa_actual: l.etapa_actual,
      stageIndex,
      estado: l.estado,
      blockchainId: l.blockchain_id,
      litrosRestantes: l.litrosRestantes ?? l.litros_restantes ?? 0,
    };
  });
}

/**
 * Avanza un lote en la cadena de producción usando el código de lote.
 * El backend se encarga de obtener el blockchain_id y cualquier otro
 * dato necesario de la base de datos.
 */
export async function advanceStage(codigoLoteOrBlockchainId, toStageIndexOrPayload, maybePayload) {
  // Soporte: advanceStage(blockchainId, etapa, { kgAceiteNeto, acidez, peroxidos })
  // o advanceStage(codigoLote, etapa) (legado) — preferir el uso de blockchainId.
  let payload = {};
  if (maybePayload) {
    // called as (blockchainId, etapa, payload)
    payload = {
      idLoteBlockchain: codigoLoteOrBlockchainId,
      codigoLote: maybePayload.codigoLote,
      etapa: toStageIndexOrPayload,
      kgAceiteNeto: maybePayload.kgAceiteNeto || 0,
      acidez: maybePayload.acidez || 0,
      peroxidos: maybePayload.peroxidos || 0,
    };
  } else if (typeof toStageIndexOrPayload === "object") {
    // llamado como (codigoLote, payload)
    payload = {
      codigoLote: codigoLoteOrBlockchainId,
      etapa: toStageIndexOrPayload.etapa,
      kgAceiteNeto: toStageIndexOrPayload.kgAceiteNeto || 0,
      acidez: toStageIndexOrPayload.acidez || 0,
      peroxidos: toStageIndexOrPayload.peroxidos || 0,
    };
  } else {
    // llamado como (codigoLote, etapa)
    payload = { codigoLote: codigoLoteOrBlockchainId, etapa: toStageIndexOrPayload };
  }

  const response = await request("POST", "/avanzar-etapa", payload);
  if (!response.success) {
    throw new Error(response.error || response.message || "Error al avanzar etapa");
  }
  return response;
}

export async function reportInvalidTransition(blockchainId, stageIndex, motivo) {
  const response = await request("POST", "/registrar-intento-transicion", {
    idLoteBlockchain: blockchainId,
    etapaDestino: stageIndex,
    motivo,
  });

  if (!response.success) {
    throw new Error(response.error || response.message || "No se pudo registrar el intento inválido");
  }

  return response;
}

export async function getLoteTimeline(sqliteId) {
  const response = await request("GET", `/historial-sqlite/${sqliteId}`);

  if (!response.success) {
    throw new Error(response.error || response.message || "No se pudo obtener la trazabilidad del lote");
  }

  return response.data || [];
}

export async function auditarLote(sqliteId) {
  const response = await request("GET", `/auditar/${sqliteId}`);
  if (!response.success) {
    throw new Error(response.error || response.message || "No se pudo auditar el lote");
  }
  return response.auditoria;
}

export async function fetchUltimosLotes() {
  const response = await request("GET", "/ultimos");
  if (!response.success) {
    throw new Error(response.error || response.message || "No se pudieron obtener los ultimos lotes");
  }
  return response.data || [];
}

export function setLotes(next) {
  save(next);
  return next;
}

export function generateCodigo() {
  const lotes = load();
  const year = new Date().getFullYear();
  const prefix = `LOT-${year}-`;


  const nums = lotes
    .filter((l) => typeof l.codigo === "string" && l.codigo.startsWith(prefix))
    .map((l) => Number(l.codigo.replace(prefix, "")))
    .filter((n) => Number.isFinite(n));

  const nextN = (nums.length ? Math.max(...nums) : 0) + 1;
  const seq = String(nextN).padStart(3, "0");
  return `${prefix}${seq}`;
}

export function createLote(payload) {
  const lotes = load();

  const nuevo = {
    id: crypto.randomUUID(),
    codigo: generateCodigo(),
    fechaRecepcion: payload.fechaRecepcion,
    productor: payload.productor.trim(),
    origen: payload.origen.trim(),
    estado: payload.estado,
    contenedorTipo: payload.contenedorTipo,
    contenedorCantidad: Number(payload.contenedorCantidad),
    variedad: payload.variedad.trim(),
    kg: Number(payload.kg),
    stageIndex: 0, // etapa inicial
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    idBlockchain: null, // Se llenará cuando responda el backend
  };

  const next = [nuevo, ...lotes];
  save(next);
  return { lote: nuevo, lotes: next };
}

// Enviar lote al blockchain (backend)
export async function submitLoteToBlockchain(loteId) {
  const lotes = load();
  const idx = lotes.findIndex((l) => l.id === loteId);
  if (idx === -1) throw new Error("Lote no encontrado localmente.");

  const lote = lotes[idx];

  try {
    // Enviar remito al backend
    const response = await request("POST", "/crear-lote", { remito: lote.codigo });

    if (!response.success || !response.data?.idBlockchain) {
      throw new Error(response.error || "No se obtuvo ID de blockchain");
    }

    // Actualizar lote con idBlockchain
    lotes[idx] = {
      ...lotes[idx],
      idBlockchain: response.data.idBlockchain,
      txHash: response.data.txHash,
      updatedAt: new Date().toISOString(),
    };

    save(lotes);
    return lotes[idx];
  } catch (error) {
    console.error("❌ Error al enviar lote al blockchain:", error);
    throw error;
  }
}

// Simula guardado async con posibilidad de fallo
export async function updateLoteStageAsync(loteId, toStageIndex) {
  await sleep(rand(MIN_DELAY, MAX_DELAY));

  // Validación básica
  if (toStageIndex < 0 || toStageIndex >= STAGES.length) {
    throw new Error("Etapa inválida.");
  }

  // Falla aleatoria
  if (Math.random() < FAIL_RATE) {
    throw new Error("Error al guardar el cambio (simulado).");
  }

  const lotes = load();
  const idx = lotes.findIndex((l) => l.id === loteId);
  if (idx === -1) throw new Error("Lote no encontrado.");

  lotes[idx] = {
    ...lotes[idx],
    stageIndex: toStageIndex,
    updatedAt: new Date().toISOString(),
  };

  save(lotes);
  return lotes[idx];
}

export async function getHistorial(search = "", page = 1, limit = 10) {
  const res = await fetch(`${LOTES_ENDPOINT}/lotes?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`, {
    credentials: "include"
  });
  if (!res.ok) throw new Error("Error al obtener el historial");
  return await res.json();
}

async function downloadExcel(endpoint, fallbackFileName) {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) throw new Error("Error al exportar archivo Excel");

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  const disposition = res.headers.get("Content-Disposition") || "";
  const fileMatch = disposition.match(/filename="?([^";]+)"?/i);
  const fileName = fileMatch?.[1] || fallbackFileName;

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export async function exportarLotesExcel(search = "") {
  const endpoint = `${LOTES_ENDPOINT}/lotes/export?search=${encodeURIComponent(search)}`;
  await downloadExcel(endpoint, "lotes_ultimos_3_anios.xlsx");
}

export async function exportarHistorialLoteExcel(sqliteId) {
  const endpoint = `${LOTES_ENDPOINT}/historial-sqlite/${sqliteId}/export`;
  await downloadExcel(endpoint, `historial_lote_sqlite_${sqliteId}.xlsx`);
}

export function getVariedades() {
  return request("GET", "/variedades");
}

export function getMotivosCancelacion() {
  return request("GET", "/motivos-cancelacion");
}

export function crearLote(payload) {
  return request("POST", "/crear-lote", payload);
}

export function cancelarLote(payload) {
  return request("POST", "/cancelar-lote", payload);
}