import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recover as apiRecover } from "../services/authService";

function strongPassword(p) {
  return (
    typeof p === "string" &&
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

export default function Recover({ toast }) {
  const nav = useNavigate();
  const [masterKey, setMasterKey] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();

    if (p1 !== p2) return toast.error("Las contraseñas no coinciden.");
    if (!strongPassword(p1))
      return toast.error("Contraseña débil: mínimo 8, mayúscula, minúscula, número y símbolo.");

    setLoading(true);
    try {
      await apiRecover(masterKey, p1);
      toast.success("Contraseña actualizada. Ya podés iniciar sesión.");
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-6 space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-semibold">Recuperación</h1>
          <p className="text-sm text-base-content/70">Requiere clave maestra (Soporte IT).</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Clave maestra</span>
            </label>
            <input
              className="input input-bordered"
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              placeholder="Ingresá la clave maestra"
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Nueva contraseña</span>
            </label>
            <input
              className="input input-bordered"
              type="password"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              placeholder="Ej: NuevaPass-123!"
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Mínimo 8, mayúscula, minúscula, número y símbolo.
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Repetir nueva contraseña</span>
            </label>
            <input
              className="input input-bordered"
              type="password"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="Repetí la nueva contraseña"
            />
          </div>

          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>

          <div className="text-center">
            <Link to="/login" className="link link-hover text-sm">
              Volver
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
