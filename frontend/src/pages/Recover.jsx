import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recover as apiRecover } from "../services/authService";


function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.25 12s3.75-7.5 9.75-7.5S21.75 12 21.75 12s-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.375A3.375 3.375 0 1 0 12 8.625a3.375 3.375 0 0 0 0 6.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.477 10.48A3.375 3.375 0 0 0 13.52 13.52"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.88 5.25A10.63 10.63 0 0 1 12 4.5c6 0 9.75 7.5 9.75 7.5a18.1 18.1 0 0 1-3.243 4.493"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.19 6.19C3.484 8.057 2.25 12 2.25 12s3.75 7.5 9.75 7.5c1.3 0 2.512-.22 3.62-.62"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  // Estados para visibilidad (Default: false -> Clave oculta)
  const [showMaster, setShowMaster] = useState(false);
  const [showP1, setShowP1] = useState(false);
  const [showP2, setShowP2] = useState(false);

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
          
          {/* CLAVE MAESTRA */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Clave maestra</span>
            </label>
            <div className="relative">
              <input
                className="input input-bordered w-full pr-12"
                type={showMaster ? "text" : "password"}
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Ingresá la clave maestra"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-ghost btn-square absolute right-1 top-1"
                onClick={() => setShowMaster(!showMaster)}
              >
                {showMaster ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* NUEVA CONTRASEÑA */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Nueva contraseña</span>
            </label>
            <div className="relative">
              <input
                className="input input-bordered w-full pr-12"
                type={showP1 ? "text" : "password"}
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                placeholder="Ej: NuevaPass-123!"
              />
              <button
                type="button"
                className="btn btn-ghost btn-square absolute right-1 top-1"
                onClick={() => setShowP1(!showP1)}
              >
                {showP1 ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Mínimo 8, mayúscula, minúscula, número y símbolo.
              </span>
            </label>
          </div>

          {/* REPETIR CONTRASEÑA */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Repetir nueva contraseña</span>
            </label>
            <div className="relative">
              <input
                className="input input-bordered w-full pr-12"
                type={showP2 ? "text" : "password"}
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                placeholder="Repetí la nueva contraseña"
              />
              <button
                type="button"
                className="btn btn-ghost btn-square absolute right-1 top-1"
                onClick={() => setShowP2(!showP2)}
              >
                {showP2 ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
              </button>
            </div>
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