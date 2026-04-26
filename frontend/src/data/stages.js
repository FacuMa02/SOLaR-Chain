export const STAGES = [
  "Recepción",
  "Molienda",
  "Batido",
  "Centrifugado",
  "Decantado",
  "Analisis",
  "Almacenamiento",
  "Lampante",
];

// Índices de etapa virtual (no existen en blockchain)
export const VIRTUAL_STAGES = new Set([7]);

// Transiciones que no requieren datos de entrada
export const SIMPLE_TRANSITIONS = new Set(["0-1", "1-2", "2-3", "4-5"]);

// Transición que requiere solo kg de aceite neto
export const KG_ACEITE_TRANSITION = "3-4";

// Transición que requiere acidez + peroxidos + kg de aceite neto
export const QUALITY_TRANSITION = "5-6";
