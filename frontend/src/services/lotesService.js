import { STAGES } from "../data/stages";
import * as api from "./apiClient";

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
    const response = await api.post("/crear-lote", { remito: lote.codigo });

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
