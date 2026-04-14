import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../services/apiClient"; // Asegúrate de que esta ruta sea la correcta

const ESTADOS = ["buena", "regular", "mala"];
const TIPOS = ["Cajones", "Bolsas"];

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NuevoRemito({ onCreate, toast }) {
  const nav = useNavigate();

  const [fechaRecepcion, setFechaRecepcion] = useState(todayISO());
  const [productor, setProductor] = useState("");
  const [origen, setOrigen] = useState("");
  const [estado, setEstado] = useState("");
  const [contenedorTipo, setContenedorTipo] = useState("Cajones");
  const [contenedorCantidad, setContenedorCantidad] = useState(1);
  const [idVariedad, setIdVariedad] = useState(""); // Ahora guarda el ID numérico
  const [kg, setKg] = useState("");

  // Estados para el catálogo de variedades
  const [variedadesDb, setVariedadesDb] = useState([]);
  const [loadingVariedades, setLoadingVariedades] = useState(true);

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Cargar variedades dinámicamente
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

  const resumenContenedor = useMemo(() => {
    const n = Number(contenedorCantidad || 0);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const suf = contenedorTipo === "Bolsas" ? "B" : "C";
    return `${n}${suf}`;
  }, [contenedorCantidad, contenedorTipo]);

  function validate() {
    const e = {};
    if (!fechaRecepcion) e.fechaRecepcion = "Fecha obligatoria";
    if (!productor.trim()) e.productor = "Productor obligatorio";
    if (!origen.trim()) e.origen = "Origen obligatorio";
    if (!estado) e.estado = "Estado obligatorio";
    if (!idVariedad) e.idVariedad = "Variedad obligatoria"; // Nueva validación
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
      const variedadSeleccionada = variedadesDb.find((v) => String(v.id) === String(idVariedad));
      if (!variedadSeleccionada?.nombre) {
        throw new Error("Variedad inválida. Volvé a seleccionar una opción.");
      }

      await onCreate({
        fechaRecepcion,
        productor,
        origen,
        estado,
        contenedorTipo,
        contenedorCantidad: Number(contenedorCantidad),
        variedad: variedadSeleccionada.nombre,
        idVariedad: Number(idVariedad),
        kg: Number(kg),
      });

      toast.success("Remito creado correctamente");
      nav("/remitos");
    } catch (err) {
      toast.error(err?.message || "No se pudo crear el remito.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-base-100 rounded-2xl shadow p-5 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Nuevo Remito</h1>
          <p className="text-sm text-base-content/70">Ingrese los datos de la materia prima recibida</p>
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
                <span className="label-text">Productor *</span>
              </label>
              <input
                className={`input input-bordered ${errors.productor ? "input-error" : ""}`}
                value={productor}
                onChange={(e) => setProductor(e.target.value)}
                placeholder="Ej: Finca Don José"
              />
              {errors.productor && (
                <span className="text-xs text-error mt-1">{errors.productor}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Origen *</span>
              </label>
              <input
                className={`input input-bordered ${errors.origen ? "input-error" : ""}`}
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="Ej: Arauco / Chilecito"
              />
              {errors.origen && (
                <span className="text-xs text-error mt-1">{errors.origen}</span>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Estado *</span>
              </label>
              <select
                className={`select select-bordered ${errors.estado ? "select-error" : ""}`}
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="" disabled>
                  Seleccionar...
                </option>
                {ESTADOS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              {errors.estado && <span className="text-xs text-error mt-1">{errors.estado}</span>}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Cajones / Bolsas *</span>
              </label>
              <div className="flex gap-2">
                <select
                  className="select select-bordered w-40"
                  value={contenedorTipo}
                  onChange={(e) => setContenedorTipo(e.target.value)}
                >
                  {TIPOS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  className="input input-bordered w-32"
                  value={contenedorCantidad}
                  onChange={(e) => setContenedorCantidad(e.target.value)}
                />

                <div className="badge badge-outline self-center">{resumenContenedor}</div>
              </div>
              <span className="text-xs text-base-content/60 mt-1">
                Ejemplo resumen: 9B (Bolsas) / 9C (Cajones)
              </span>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Variedad *</span>
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
                <span className="label-text">KG *</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={`input input-bordered ${errors.kg ? "input-error" : ""}`}
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="Ej: 1200.5"
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
              {saving ? "Guardando..." : "Guardar remito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}