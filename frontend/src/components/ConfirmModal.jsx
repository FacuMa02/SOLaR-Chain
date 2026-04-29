import { useEffect, useState } from "react";
import { STAGES, SIMPLE_TRANSITIONS, KG_ACEITE_TRANSITION, QUALITY_TRANSITION } from "../data/stages";

export default function ConfirmModal({ open, title, subtitle, fromIndex, toIndex, onConfirm, onCancel, loading }) {
  const [kgAceiteNeto, setKgAceiteNeto] = useState("");
  const [acidez, setAcidez] = useState("");
  const [peroxidos, setPeroxidos] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKgAceiteNeto("");
      setAcidez("");
      setPeroxidos("");
    }
  }, [open]);

  if (!open) return null;

  const transKey = `${fromIndex}-${toIndex}`;
  const isSimple = SIMPLE_TRANSITIONS.has(transKey);
  const isKgAceite = transKey === KG_ACEITE_TRANSITION;
  const isFullQuality = transKey === QUALITY_TRANSITION;

  const fromName = STAGES[fromIndex] ?? fromIndex;
  const toName = STAGES[toIndex] ?? toIndex;

  function handleConfirm() {
    if (!onConfirm) return;
    onConfirm({
      kgAceiteNeto: Number(kgAceiteNeto) || 0,
      acidez: Number(acidez) || 0,
      peroxidos: Number(peroxidos) || 0,
    });
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{title || `${fromName} → ${toName}`}</h3>
          {subtitle ? <p className="text-sm text-base-content/70">{subtitle}</p> : null}
        </div>

        {isSimple && (
          <p className="text-base-content/80">
            ¿Desea transicionar de <strong>{fromName}</strong> a <strong>{toName}</strong>?
          </p>
        )}

        {isKgAceite && (
          <div className="space-y-3">
            <p className="text-sm text-base-content/70">
              Ingrese la masa neta de aceite obtenida en centrifugado. El rendimiento estimado
              se calculará automáticamente.
            </p>
            <div>
              <label className="block text-sm font-medium">Masa neta de aceite (kg)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input input-bordered w-full mt-1"
                value={kgAceiteNeto}
                onChange={(e) => setKgAceiteNeto(e.target.value)}
                disabled={loading}
                placeholder="ej: 160"
              />
            </div>
          </div>
        )}

        {isFullQuality && (
          <div className="space-y-3">
            <p className="text-sm text-base-content/70">
              Ingrese los parámetros analíticos finales. El rendimiento industrial definitivo
              se calculará automáticamente.
            </p>
            <div>
              <label className="block text-sm font-medium">Masa neta final de aceite (kg)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input input-bordered w-full mt-1"
                value={kgAceiteNeto}
                onChange={(e) => setKgAceiteNeto(e.target.value)}
                disabled={loading}
                placeholder="ej: 158"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Índice de acidez (%)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input input-bordered w-full mt-1"
                value={acidez}
                onChange={(e) => setAcidez(e.target.value)}
                disabled={loading}
                placeholder="ej: 0.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Índice de peróxidos (meq O₂/kg)</label>
              <input
                type="number"
                step="any"
                min="0"
                className="input input-bordered w-full mt-1"
                value={peroxidos}
                onChange={(e) => setPeroxidos(e.target.value)}
                disabled={loading}
                placeholder="ej: 12"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={loading}>
            {isSimple ? "No" : "Cancelar"}
          </button>
          <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? "Guardando..." : isSimple ? "Sí" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
