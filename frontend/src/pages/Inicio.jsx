import { useMemo, useState } from "react";
import { STAGES } from "../data/stages";
import LotesTable from "../components/LotesTable";

export default function Inicio({ lotes }) {
  const [q, setQ] = useState("");

  const stageNameByIndex = (i) => STAGES[i] || "—";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lotes;
    return lotes.filter((l) => String(l.codigo).toLowerCase().includes(s));
  }, [q, lotes]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Inicio</h1>
          <p className="text-sm text-base-content/70">
            Resumen simple de lotes. Usá el menú superior para navegar.
          </p>
        </div>

        {/*buscador por código */}
        <div className="form-control">
          <label className="label">
            <span className="label-text">Buscar por código de lote</span>
          </label>
          <input
            className="input input-bordered"
            placeholder="Ej: LOT-2025-001"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <LotesTable lotes={filtered} stageNameByIndex={stageNameByIndex} />
      </div>
    </div>
  );
}
