import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/solar-225.jpg";
import { initializeAuth } from "../services/authService";

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

export default function FirstRunExperience({ toast, onInitialized }) {
  const nav = useNavigate();
  const [masterKey, setMasterKey] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    
    if (!masterKey.trim()) {
      toast.error("La clave maestra no puede estar vacía");
      return;
    }
    
    if (!adminPassword.trim()) {
      toast.error("La contraseña no puede estar vacía");
      return;
    }

    if (adminPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (adminPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (masterKey.length < 8) {
      toast.error("La clave maestra debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      await initializeAuth(masterKey, adminPassword);

      toast.success("¡Sistema inicializado correctamente!");
      setMasterKey("");
      setAdminPassword("");
      setConfirmPassword("");
      
      // Notificar al padre que se completó la inicialización
      onInitialized();
      
      // Redirigir al login
      nav("/login", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-theme="light" className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-6 space-y-5">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold">SOLaR - Configuración Inicial</h1>
          <img src={logo} alt="Logo SOLaR" width={225} height={225} className="mx-auto rounded-xl" />
          <p className="text-sm text-base-content/70">
            Esta es la primera vez que se ejecuta la aplicación.
            <br />
            Configura las credenciales de acceso ahora.
          </p>
        </div>

        <div className="divider">Credenciales de Administrador</div>

        <form onSubmit={submit} className="space-y-4">
          {/* Clave Maestra */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Clave Maestra</span>
              <span className="label-text-alt text-warning">Requerida para recuperación</span>
            </label>
            <div className="relative">
              <input
                type={showMasterKey ? "text" : "password"}
                value={masterKey}
                onChange={(e) => setMasterKey(e.target.value)}
                placeholder="Ingresa una clave maestra segura"
                className="input input-bordered w-full bg-base-200 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowMasterKey(!showMasterKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                disabled={loading}
              >
                {showMasterKey ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            <label className="label">
              <span className="label-text-alt text-xs">
                Mínimo 8 caracteres. Úsala si olvidas tu contraseña.
              </span>
            </label>
          </div>

          {/* Contraseña de Administrador */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Contraseña de Administrador</span>
              <span className="label-text-alt text-warning">Para acceder a la aplicación</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="input input-bordered w-full bg-base-200 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirmar Contraseña */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Confirmar Contraseña</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu contraseña"
                className="input input-bordered w-full bg-base-200 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                disabled={loading}
              >
                {showConfirm ? (
                  <EyeOffIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Inicializando...
              </>
            ) : (
              "Inicializar Sistema"
            )}
          </button>
        </form>

        <div className="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>
            <strong>Importante:</strong> Guarda estos datos en lugar seguro. No podrás cambiar la clave maestra sin el acceso administrativo.
          </span>
        </div>
      </div>
    </div>
  );
}
