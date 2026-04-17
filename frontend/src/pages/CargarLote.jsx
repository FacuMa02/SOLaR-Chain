import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../services/apiClient";
import LoteCodeInput, { buildCodigoLote } from "../components/LoteCodeInput";

export default function CargarLote({ toast }) {
  const nav = useNavigate();

  const [codigoLote, setCodigoLote] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [idVariedad, setIdVariedad] = useState("");
  const [pesoKg, setPesoKg] = useState("");

  // Nuevos estados para el renderizado dinámico
  const [variedadesDb, setVariedadesDb] = useState([]);
  const [loadingVariedades, setLoadingVariedades] = useState(true);

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Hook para traer los catálogos al cargar la pantalla
  useEffect(() => {
    async function fetchVariedades() {
      try {
        const res = await api.get("/lotes/variedades");
        if (res.success) {
          setVariedadesDb(res.data);
        }
      } catch (error) {
        toast.error("Error al cargar el catálogo de variedades.");
      } finally {
        setLoadingVariedades(false);
      }
    }
    fetchVariedades();
  }, [toast]);

  function validate() {
    const e = {};
    if (!codigoLote.trim()) e.codigoLote = "Código obligatorio";
    if (!fechaInicio) e.fechaInicio = "Fecha obligatoria";
    if (!idVariedad) e.idVariedad = "Variedad obligatoria";
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
        codigoLote: buildCodigoLote(codigoLote),
        fechaInicio,
        idVariedad: Number(idVariedad),
        pesoKg: Number(pesoKg),
      };

      await api.post("/lotes/crear-lote", body);

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
            <LoteCodeInput value={codigoLote} onChange={setCodigoLote} error={errors.codigoLote} />

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
              <select
                className={`select select-bordered w-full ${errors.idVariedad ? "select-error" : ""}`}
                value={idVariedad}
                onChange={(e) => setIdVariedad(e.target.value)}
                disabled={loadingVariedades}
              >
                <option value="">
                  {loadingVariedades ? "Cargando catálogos..." : "Seleccione una variedad..."}
                </option>
                {/* Renderizado dinámico leyendo del estado */}
                {variedadesDb.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
              {errors.idVariedad && (
                <span className="text-xs text-error mt-1">{errors.idVariedad}</span>
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