
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/solar-225.jpg";
import { login as apiLogin, API_BASE } from "../services/authService";

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

export default function Login({ onLoggedIn, toast }) {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiLogin(password);
      onLoggedIn(); // guarda sesión local
      setPassword("");
      setShow(false);
      nav("/", { replace: true }); // va directo a Inicio
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-6 space-y-5">
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">SOLaR - Acceso</h1>
          <img src={logo} alt="Logo SOLaR" width={225} height={225} className="mx-auto rounded-xl" />
          <p className="text-sm text-base-content/70">
            Sistema offline — usuario fijo: <span className="font-semibold">admin</span>
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Usuario</span>
            </label>
            <input className="input input-bordered bg-base-200" value="admin" disabled />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Contraseña</span>
            </label>
            <div className="relative">
              <input
                className="input input-bordered w-full pr-12"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresá tu contraseña"
                autoFocus
              />
              <button
                type="button"
                className="btn btn-ghost btn-square absolute right-1 top-1"
                onClick={() => setShow((v) => !v)}
                title={show ? "Ocultar" : "Mostrar"}
              >
                {show ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="text-center">
            <Link to="/recover" className="link link-hover text-sm">
              Olvidé mi contraseña
            </Link>
          </div>
        </form>

        <div className="text-xs text-base-content/60">
          Backend esperado en: <span className="font-mono">{API_BASE}</span>
        </div>
      </div>
    </div>
  );
}
