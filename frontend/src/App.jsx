import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import Topbar from "./components/Topbar";
import ToastHost from "./components/ToastHost";

import Inicio from "./pages/Inicio";
import NuevoLote from "./pages/NuevoLote";
import ProcesoProductivo from "./pages/ProcesoProductivo";

import Login from "./pages/Login";
import Recover from "./pages/Recover";


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
  const [lotes, _setLotes] = useState(() => lotesSvc.getLotes());

  useEffect(() => {
    lotesSvc.setLotes(lotes);
  }, [lotes]);

  function setLotes(next) {
    _setLotes(next);
  }

  // API mock Kanban
  const api = useMemo(() => {
    return {
      updateStage: (loteId, toIndex) => lotesSvc.updateLoteStageAsync(loteId, toIndex),
    };
  }, []);

  async function onCreateLote(payload) {
    // 1. Crear lote localmente
    const { lote, lotes: next } = lotesSvc.createLote(payload);
    setLotes(next);

    // 2. Enviar al blockchain (en background)
    try {
      await lotesSvc.submitLoteToBlockchain(lote.id);
      // Actualizar estado con el idBlockchain
      const updated = lotesSvc.getLotes();
      setLotes(updated);
      toast.success("Lote enviado al blockchain");
    } catch (err) {
      console.error("Error enviando a blockchain:", err);
      toast.error(`Lote creado pero no se pudo registrar en blockchain: ${err.message}`);
    }
  }

  
  function LogoutWrapper() {
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
        <Route path="/recover" element={authed ? <Navigate to="/" replace /> : <Recover toast={toast} />} />

        {/* Protected app */}
        <Route
          element={authed ? <ProtectedLayout onLogout={doLogout} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Inicio lotes={lotes} />} />
          <Route path="/nuevo-lote" element={<NuevoLote onCreate={onCreateLote} toast={toast} />} />
          <Route
            path="/proceso"
            element={<ProcesoProductivo lotes={lotes} setLotes={setLotes} api={api} toast={toast} />}
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={authed ? "/" : "/login"} replace />} />
      </Routes>
    );
  }

  return (
    <BrowserRouter>
      <ToastHost toasts={toasts} />
      <LogoutWrapper />
    </BrowserRouter>
  );
}
