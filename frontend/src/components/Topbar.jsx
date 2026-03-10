import { NavLink } from "react-router-dom";

function tabClass({ isActive }) {
  return `tab tab-bordered ${isActive ? "tab-active" : ""}`;
}

export default function Topbar({ onLogout }) {
  return (
    <div className="navbar bg-base-100 border-b sticky top-0 z-50">
      <div className="max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-lg">SOLaR</div>
          <div className="text-xs text-base-content/60">Trazabilidad de Lotes</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="tabs">
            <NavLink to="/" className={tabClass} end>
              Inicio
            </NavLink>
            <NavLink to="/nuevo-remito" className={tabClass}>
              Nuevo remito
            </NavLink>
            <NavLink to="/cargar-lote" className={tabClass}>
              Cargar lote
            </NavLink>
            <NavLink to="/cancelar-lote" className={tabClass}>
              Cancelar lote
            </NavLink>
            <NavLink to="/proceso" className={tabClass}>
              Proceso productivo
            </NavLink>
            <NavLink to="/historial" className={tabClass}>
              Historial
            </NavLink>
          </div>

          <button className="btn btn-sm btn-outline" onClick={onLogout} type="button">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
