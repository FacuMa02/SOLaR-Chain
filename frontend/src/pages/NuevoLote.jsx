import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ESTADOS = ["buena", "regular", "mala"];
const TIPOS = ["Cajones", "Bolsas"];

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NuevoLote({ onCreate, toast }) {
  const nav = useNavigate();

  const [fechaRecepcion, setFechaRecepcion] = useState(todayISO());
  const [variedad, setVariedad] = useState("Mezcla");
  const [kg, setKg] = useState("");

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e = {};
    if (!fechaRecepcion) e.fechaRecepcion = "Fecha obligatoria";
    const kgN = Number(kg);
    if (!Number.isFinite(kgN) || kgN <= 0) e.kg = "KG debe ser > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onCreate({
        fechaRecepcion,
        variedad,
        kg,
      });

      toast.success("Lote creado correctamente");
      nav("/proceso");
    } catch (err) {
      toast.error(err?.message || "No se pudo crear el lote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Nuevo Lote</h1>
          <p className="text-sm text-base-content/70">Descripción</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Fecha de recepción *</span>
              </label>
              <input
                type="date"
                className={`input input-bordered ${errors.fechaRecepcion ? "input-error" : ""}`}
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
              />
              {errors.fechaRecepcion && (
                <span className="text-xs text-error mt-1">{errors.fechaRecepcion}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Variedad</span>
              </label>
              <input
                className="input input-bordered"
                value={variedad}
                onChange={(e) => setVariedad(e.target.value)}
                placeholder="Ej: Mezcla"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">KG *</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={`input input-bordered ${errors.kg ? "input-error" : ""}`}
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="Ej: 1200"
              />
              {errors.kg && <span className="text-xs text-error mt-1">{errors.kg}</span>}
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
