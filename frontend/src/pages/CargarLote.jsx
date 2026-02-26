import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../services/apiClient";

export default function CargarLote({ toast }) {
  const nav = useNavigate();

  const [codigoLote, setCodigoLote] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [variedad, setVariedad] = useState("");
  const [pesoKg, setPesoKg] = useState("");

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e = {};
    if (!codigoLote.trim()) e.codigoLote = "Código obligatorio";
    if (!fechaInicio) e.fechaInicio = "Fecha obligatoria";
    if (!variedad.trim()) e.variedad = "Variedad obligatoria";
    const pesoN = Number(pesoKg);
    if (!Number.isFinite(pesoN) || pesoN <= 0) e.pesoKg = "KG debe ser > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        codigoLote: codigoLote.trim(),
        fechaInicio,
        variedad: variedad.trim(),
        pesoKg: Number(pesoKg),
      };

      const res = await api.post("/lotes/crear-lote", body);

      toast.success("Lote creado correctamente");
      nav("/");
    } catch (err) {
      toast.error(err.message || "No se pudo crear el lote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Cargar Lote</h1>
          <p className="text-sm text-base-content/70">Ingrese los datos del lote para enviar a blockchain</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Código de lote *</span>
              </label>
              <input
                className={`input input-bordered ${errors.codigoLote ? "input-error" : ""}`}
                value={codigoLote}
                onChange={(e) => setCodigoLote(e.target.value)}
                placeholder="Ej: LOT-2026-001"
              />
              {errors.codigoLote && (
                <span className="text-xs text-error mt-1">{errors.codigoLote}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Fecha de Inicio de Molienda *</span>
              </label>
              <input
                type="date"
                className={`input input-bordered ${errors.fechaInicio ? "input-error" : ""}`}
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
              {errors.fechaInicio && (
                <span className="text-xs text-error mt-1">{errors.fechaInicio}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Variedad de Aceituna *</span>
              </label>
              <input
                className={`input input-bordered ${errors.variedad ? "input-error" : ""}`}
                value={variedad}
                onChange={(e) => setVariedad(e.target.value)}
                placeholder="Ej: Arauco"
              />
              {errors.variedad && (
                <span className="text-xs text-error mt-1">{errors.variedad}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Peso en KG *</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={`input input-bordered ${errors.pesoKg ? "input-error" : ""}`}
                value={pesoKg}
                onChange={(e) => setPesoKg(e.target.value)}
                placeholder="Ej: 1200.5"
              />
              {errors.pesoKg && (
                <span className="text-xs text-error mt-1">{errors.pesoKg}</span>
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creando…" : "Crear lote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
