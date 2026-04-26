import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMotivosCancelacion, cancelarLote } from "../services/lotesService";
import LoteCodeInput, { buildCodigoLote } from "../components/LoteCodeInput";
import MemoryInput from "../components/MemoryInput";

export default function CancelarLote({ toast }) {
  const nav = useNavigate();

  const [codigoLote, setCodigoLote] = useState("");
  const [motivo, setMotivo] = useState("");
  const [motivosDb, setMotivosDb] = useState([]);

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchMotivos() {
      try {
        const res = await getMotivosCancelacion();
        if (res.success) {
          setMotivosDb(res.data?.motivos || []);
        }
      } catch {
        // Si no hay historial previo, el campo sigue funcionando como input libre.
      }
    }

    fetchMotivos();
  }, []);

  function validate() {
    const e = {};
    if (!codigoLote.trim()) e.codigoLote = "Código obligatorio";
    if (!motivo.trim()) e.motivo = "Motivo obligatorio";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        codigoLote: buildCodigoLote(codigoLote),
        motivo: motivo.trim(),
      };

      await cancelarLote(body);

      toast.success("Lote cancelado correctamente");
      nav("/");
    } catch (err) {
      toast.error(err.message || "No se pudo cancelar el lote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Cancelar Lote</h1>
          <p className="text-sm text-base-content/70">Ingrese los datos para cancelar un lote en blockchain</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <LoteCodeInput value={codigoLote} onChange={setCodigoLote} error={errors.codigoLote} />

            <div className="form-control">
              <label className="label">
                <span className="label-text">Motivo *</span>
              </label>
              <MemoryInput
                value={motivo}
                onValueChange={setMotivo}
                options={motivosDb}
                placeholder="Ej: Defecto en calidad"
                error={errors.motivo}
                title="Motivos previos"
                emptyMessage="No hay motivos previos que coincidan."
              />
              {errors.motivo && (
                <span className="text-xs text-error mt-1">{errors.motivo}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => nav("/")}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-error" disabled={saving}>
              {saving ? "Cancelando…" : "Cancelar lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
