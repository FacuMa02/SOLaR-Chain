import { useEffect, useState } from "react";

export default function ConfirmModal({ open, title, subtitle, onConfirm, onCancel, loading }) {
  const [peroxidos, setPeroxidos] = useState(0);
  const [acidez, setAcidez] = useState(0);
  const [rendimiento, setRendimiento] = useState(0);

  useEffect(() => {
    if (open) {
      setPeroxidos(0);
      setAcidez(0);
      setRendimiento(0);
    }
  }, [open]);

  if (!open) return null;

  function handleConfirm() {
    if (onConfirm) {
      onConfirm({ peroxidos: Number(peroxidos) || 0, acidez: Number(acidez) || 0, rendimiento: Number(rendimiento) || 0 });
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm text-base-content/70">{subtitle}</p> : null}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Ind. de Peróxidos</label>
            <input
              type="number"
              step="any"
              className="input input-bordered w-full mt-1"
              value={peroxidos}
              onChange={(e) => setPeroxidos(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Ind. de Acidez</label>
            <input
              type="number"
              step="any"
              className="input input-bordered w-full mt-1"
              value={acidez}
              onChange={(e) => setAcidez(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Rendimiento</label>
            <input
              type="number"
              step="any"
              className="input input-bordered w-full mt-1"
              value={rendimiento}
              onChange={(e) => setRendimiento(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" onClick={handleConfirm} disabled={loading}>
            {loading ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
