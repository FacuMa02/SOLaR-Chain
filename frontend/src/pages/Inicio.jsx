import { useEffect, useMemo, useState } from "react";
import { fetchUltimosLotes } from "../services/lotesService";
import { auditarTolva } from "../services/tolvaService";

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Inicio({ toast }) {
  const [q, setQ] = useState("");
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tolva, setTolva] = useState({
    pesoDisponible: 0,
    hashIntegridad: "",
    auditoria: { estado: "DESCONOCIDO", esValido: null },
  });
  const [tolvaLoading, setTolvaLoading] = useState(false);

  useEffect(() => {
    async function loadInicioData() {
      setLoading(true);
      try {
        const data = await fetchUltimosLotes();
        setLotes(data);
      } catch (err) {
        toast.error(err.message || "No se pudieron cargar los ultimos lotes.");
      } finally {
        setLoading(false);
      }
    }

    async function loadTolva() {
      setTolvaLoading(true);
      try {
        const data = await auditarTolva();
        setTolva(data);
      } catch (err) {
        toast.error(err.message || "No se pudo auditar la tolva.");
      } finally {
        setTolvaLoading(false);
      }
    }

    loadInicioData();
    loadTolva();
  }, [toast]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return lotes;
    return lotes.filter((l) => String(l.codigo).toLowerCase().includes(s));
  }, [q, lotes]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-4">
        <div className="rounded-xl border border-[#6b8e23]/30 bg-[#6b8e23]/10 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#3f5f12]">Estado de Tolva</h2>
              <p className="text-sm text-[#3f5f12]/80">Datos de produccion.sqlite (tabla tolva)</p>
            </div>
            {(tolvaLoading || loading) && <span className="text-sm text-[#3f5f12]/80">Actualizando...</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="bg-base-100 rounded-lg px-4 py-3 border border-[#6b8e23]/20">
              <p className="text-xs uppercase tracking-wide text-base-content/60">Kg disponibles</p>
              <p className="text-2xl font-bold text-[#3f5f12]">{Number(tolva.pesoDisponible || 0).toFixed(2)} kg</p>
            </div>
            <div className="bg-base-100 rounded-lg px-4 py-3 border border-[#6b8e23]/20">
              <p className="text-xs uppercase tracking-wide text-base-content/60">Integridad</p>
              <p className={`text-xl font-bold ${tolva.auditoria?.esValido ? "text-success" : "text-error"}`}>
                {tolva.auditoria?.estado || "DESCONOCIDO"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-semibold">Inicio</h1>
          <p className="text-sm text-base-content/70">
            Ultimos 10 lotes creados en el sistema.
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

        <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
          <table className="table table-zebra w-full">
            <thead className="bg-[#6b8e23] text-white">
              <tr>
                <th>Codigo</th>
                <th>Fecha recepcion</th>
                <th>Variedad</th>
                <th>KG</th>
                <th>Etapa actual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">Cargando...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">No se encontraron lotes.</td>
                </tr>
              ) : (
                filtered.map((lote) => (
                  <tr key={lote.id}>
                    <td className="font-semibold">{lote.codigo}</td>
                    <td>{formatDate(lote.fechaRecepcion)}</td>
                    <td>{lote.variedad}</td>
                    <td>{lote.kg} kg</td>
                    <td>{lote.etapaActual || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
