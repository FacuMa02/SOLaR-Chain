import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import Topbar from "./components/Topbar";
import ToastHost from "./components/ToastHost";

import Inicio from "./pages/Inicio";
import NuevoLote from "./pages/NuevoLote";
import ProcesoProductivo from "./pages/ProcesoProductivo";
import Historial from "./pages/Historial";

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

  // Auth (session local para UI) --------
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("solar_authed") === "1");

  // -------- Lotes (Base de Datos) ------
  const [lotes, setLotes] = useState([]);

  // Cargar lotes desde el backend al iniciar sesión
  useEffect(() => {
    if (authed) {
      lotesSvc.getLotes()
        .then(data => setLotes(data))
        .catch(err => {
          console.error("Error cargando lotes:", err);
          toast.error("Error al cargar los lotes desde la base de datos");
        });
    }
  }, [authed, toast]);

  // API real para el Kanban
  const api = useMemo(() => {
    return {
      updateStage: async (loteId, toIndex) => {
        await lotesSvc.updateLoteStageAsync(loteId, toIndex);
        // Actualizamos el estado local para que la tarjeta se mueva al instante en el frontend
        setLotes((prev) => 
          prev.map((l) => (l.id === loteId ? { ...l, stageIndex: toIndex } : l))
        );
      },
    };
  }, []);

  // Crear lote y actualizar estado
  async function onCreateLote(payload) {
    const nuevoLote = await lotesSvc.createLote(payload);
    // Agregamos el nuevo lote al principio de la lista en memoria
    setLotes((prev) => [nuevoLote, ...prev]);
  }

  function LogoutWrapper() {
    const nav = useNavigate();
    
    const doLogout = async () => {
      // Limpiamos la cookie en el backend
      try {
        await fetch("http://localhost:3001/auth/logout", { 
          method: "POST", 
          credentials: "include" 
        });
      } catch (e) {
        console.error("Error cerrando sesión en el servidor", e);
      }

      // Limpiamos el frontend
      sessionStorage.removeItem("solar_authed");
      setAuthed(false);
      setLotes([]); // Vaciamos los lotes de la memoria por seguridad
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
          <Route path="/historial" element={<Historial toast={toast} />} />
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