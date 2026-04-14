import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import Topbar from "./components/Topbar";
import ToastHost from "./components/ToastHost";

import Inicio from "./pages/Inicio";
import NuevoRemito from "./pages/NuevoRemito";
import ProcesoProductivo from "./pages/ProcesoProductivo";
import Historial from "./pages/Historial";
import ManualUsuario from "./pages/ManualUsuario";
import GetRemitos from "./pages/GetRemitos";
import DashboardAnaliticas from "./pages/DashboardAnaliticas";

import Login from "./pages/Login";
import Recover from "./pages/Recover";
import CargarLote from "./pages/CargarLote";
import CancelarLote from "./pages/CancelarLote";
import * as remitosSvc from "./services/remitosService";

import * as lotesSvc from "./services/lotesService";

function uid() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
}

function ProtectedLayout({ onLogout }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Topbar onLogout={onLogout} />
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}

function LogoutWrapper({ authed, setAuthed, toast, lotes, setLotes, onCreateRemito }) {
  const nav = useNavigate();
  const doLogout = () => {
    sessionStorage.removeItem("solar_authed");
    setAuthed(false);
    nav("/login", { replace: true });
    toast.success("Sesión cerrada");
  };

  return (
    <Routes>
      {/* Auth routes */}
      <Route
        path="/login"
        element={
          authed ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              toast={toast}
              onLoggedIn={() => {
                sessionStorage.setItem("solar_authed", "1");
                setAuthed(true);
              }}
            />
          )
        }
      />
      {/* RUTA PÚBLICA: Para cuando olvidaste la contraseña y estás deslogueado */}
      <Route path="/recover" element={authed ? <Navigate to="/" replace /> : <Recover toast={toast} />} />

      {/* Protected app */}
      <Route
        element={authed ? <ProtectedLayout onLogout={doLogout} /> : <Navigate to="/login" replace />}
      >
          <Route index element={<Inicio lotes={lotes} />} />        
    
        <Route path="/dashboard" element={<DashboardAnaliticas />} />
        <Route path="/nuevo-remito" element={<NuevoRemito onCreate={onCreateRemito} toast={toast} />} />
        <Route path="/manual" element={<ManualUsuario />} />
        <Route path="/remitos" element={<GetRemitos toast={toast} />} />
        
        <Route path="/cargar-lote" element={<CargarLote toast={toast} />} />
        <Route path="/cancelar-lote" element={<CancelarLote toast={toast} />} />
        
        <Route path="/proceso" element={<ProcesoProductivo lotes={lotes} setLotes={setLotes} toast={toast} />} />
        <Route path="/historial" element={<Historial toast={toast} />} />
        
        {/* RUTA PRIVADA: Para cambiar la contraseña desde el Topbar estando adentro */}
        <Route path="/cambiar-contrasena" element={<Recover toast={toast} />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={authed ? "/" : "/login"} replace />} />
    </Routes>

      )
}

export default function App() {
  // ----- Toasts -----
  const [toasts, setToasts] = useState([]);
  const toast = useMemo(() => {
    function push(type, text) {
      const id = uid();
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
    return {
      success: (t) => push("success", t),
      error: (t) => push("error", t),
    };
  }, []);

  // Auth (session local) --------
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("solar_authed") === "1");

  // -------- Lotes (LocalStorage) ------
  // seguiremos guardando datos locales para otras pantallas (Inicio, etc.)
  const [lotes, _setLotes] = useState(() => lotesSvc.getLotes());

  useEffect(() => {
    lotesSvc.setLotes(lotes);
  }, [lotes]);

  function setLotes(next) {
    _setLotes(next);
  }

  async function onCreateRemito(payload) {
    await remitosSvc.createRemito(payload);
  }

  return (
    <BrowserRouter>
      <ToastHost toasts={toasts} />
      <LogoutWrapper authed={authed} setAuthed={setAuthed} toast={toast} lotes={lotes} setLotes={setLotes} onCreateRemito={onCreateRemito} />    </BrowserRouter>
  );
}