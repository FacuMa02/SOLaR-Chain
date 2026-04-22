import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";

function tabClass({ isActive }) {
  return `tab tab-bordered h-auto py-2 leading-tight ${isActive ? "tab-active" : ""}`;

}

export default function Topbar({ onLogout }) {
  // --- ESTADOS PARA APARIENCIA (Persistentes en LocalStorage) ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("solar_theme") !== "light"; // Por defecto arranca oscuro
  });
  
  const [isLargeText, setIsLargeText] = useState(() => {
    return localStorage.getItem("solar_text") === "large";
  });

  
// --- EFECTOS PARA APLICAR LOS CAMBIOS ---
  useEffect(() => {
    const theme = isDarkMode ? "dark" : "light";
    
    // 1. Cambia el tema de DaisyUI
    document.documentElement.setAttribute("data-theme", theme);
    
    // 2. Le avisa a Tailwind en toda la app
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    localStorage.setItem("solar_theme", theme);
  }, [isDarkMode]);
  useEffect(() => {
    
    if (isLargeText) {
      document.documentElement.style.fontSize = "18px"; // Modo Grande
      localStorage.setItem("solar_text", "large");
    } else {
      document.documentElement.style.fontSize = "16px"; // Modo Normal
      localStorage.setItem("solar_text", "normal");
    }
  }, [isLargeText]);

  return (
    <div className="navbar bg-base-100 border-b sticky top-0 z-50">
      <div className="max-w-6xl mx-auto w-full px-4 flex items-center justify-between">
        
        {/* LADO IZQUIERDO: Logo */}
        <div className="flex flex-col">
          <div className="font-semibold text-lg leading-none">SOLaR</div>
          <div className="text-xs text-base-content/60">Trazabilidad de Lotes</div>
        </div>

        {/* LADO DERECHO: Pestañas + Menú */}
        <div className="flex items-center gap-3">
          
          <div className="tabs">
        <NavLink to="/" className={tabClass} end>
              Inicio
        </NavLink>
        <NavLink to="/dashboard" className={tabClass}>
          Dashboard
        </NavLink>
        <NavLink to="/proceso" className={tabClass}>
          Proceso productivo
        </NavLink>
        <NavLink to="/nuevo-remito" className={tabClass}>
          Nuevo remito
        </NavLink>
        <NavLink to="/remitos" className={tabClass}>
          Ver remitos
        </NavLink>
        <NavLink to="/cargar-lote" className={tabClass}>
          Cargar lote
        </NavLink>
        <NavLink to="/cancelar-lote" className={tabClass}>
          Cancelar lote
        </NavLink>
            <NavLink to="/historial" className={tabClass}>
              Historial de Lotes
            </NavLink>
          </div>

          {/* Menú Desplegable */}
          <div className="dropdown dropdown-end ml-2"> 
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-200 rounded-box w-64">
              
              {/* --- SECCIÓN: APARIENCIA --- */}
              <li>
                <details open>
                  <summary className="font-medium">Apariencia</summary>
                  <ul>
                    <li>
                      {/* Usamos un label para que todo el renglón sea clickeable */}
                      <label className="cursor-pointer flex justify-between w-full hover:bg-base-300">
                        <span>Modo oscuro</span>
                        <input 
                          type="checkbox" 
                          className="toggle toggle-sm toggle-primary" 
                          checked={isDarkMode} 
                          onChange={() => setIsDarkMode(!isDarkMode)} 
                        />
                      </label>
                    </li>
                    <li>
                      <label className="cursor-pointer flex justify-between w-full hover:bg-base-300">
                        <span>Texto grande</span>
                        <input 
                          type="checkbox" 
                          className="toggle toggle-sm toggle-primary" 
                          checked={isLargeText} 
                          onChange={() => setIsLargeText(!isLargeText)} 
                        />
                      </label>
                    </li>
                  </ul>
                </details>
              </li>

              {/* SECCIÓN: SISTEMA */}
              <li>
                <details>
                  <summary className="font-medium">Sistema</summary>
                  <ul>
                    <li>
                      <NavLink 
                        to="/manual"
                        onClick={(e) => {
                          // Cerramos el menú al hacer clic
                          e.target.closest('details').removeAttribute('open');
                          document.activeElement.blur();
                        }}
                      >
                        Manual de usuario
                      </NavLink>
                    </li>
                    <li><a onClick={() => document.getElementById('modal_acerca').showModal()}>Acerca del sistema</a></li>
                    <li><a onClick={() => document.getElementById('modal_version').showModal()}>Versión del sistema</a></li>
                  </ul>
                </details>
              </li>

             {/* SECCIÓN: SESIÓN */}
              <li>
                <details>
                  <summary className="font-medium">Sesión</summary>
                  <ul>
                    {/* Reemplazamos el <a> vacío por NavLink */}
        
                      <li>
                      <NavLink 
                        to="/cambiar-contrasena"
                        onClick={(e) => {
                          e.target.closest('details').removeAttribute('open');
                          document.activeElement.blur();
                        }}
                      >
                        Cambiar contraseña
                      </NavLink>
                    </li>
              
                    <li><a onClick={onLogout} className="text-error font-medium">Cerrar sesión</a></li>
                  </ul>
                </details>
              </li>
              
            </ul>
          </div>

        </div>
      </div>

      {/* Modal: Acerca del Sistema */}
      <dialog id="modal_acerca" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg border-b pb-2">Acerca de SOLaR-Chain</h3>
          <div className="py-4 space-y-3 text-sm">
            <p>
              Plataforma de software desarrollada para la gestión, digitalización y trazabilidad del proceso productivo en la almazara de la UNLaR.
            </p>
            <p>
              El sistema permite registrar el avance de cada lote de producción y sienta las bases para utilizar tecnología blockchain mediante contratos inteligentes, garantizando la transparencia e inmutabilidad de los datos históricos.
            </p>
            <p className="pt-2 text-base-content/60 font-medium">
              Autores: Facundo Maidana y Daniel Alejandro Perea De La Fuente.
            </p>
          </div>
          <div className="modal-action">
            <form method="dialog">
              {/* Si hay un botón dentro de un form con method="dialog", cierra el modal */}
              <button className="btn btn-sm btn-primary">Entendido</button>
            </form>
          </div>
        </div>
        {/* Este form permite cerrar el modal haciendo clic afuera de la caja */}
        <form method="dialog" className="modal-backdrop">
          <button>cerrar</button>
        </form>
      </dialog>


      {/*----------------------------------------------------------------*/}


      {/* Modal: Versión del Sistema*/}
      <dialog id="modal_version" className="modal">
        <div className="modal-box p-0 overflow-hidden bg-base-100 max-w-lg border border-base-300">
          
          {/* Cabecera con Logo y Título */}
          <div className="px-6 py-4 flex items-center gap-3 border-b border-base-300">
            {/* Ícono simulando el logo de SOLaR */}
            <div className="bg-primary text-primary-content p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-xl">SOLaR-Chain</h3>
          </div>

          {/* Caja interior de información (fondo diferente) */}
          <div className="p-6 bg-base-200/50">
            <div className="flex items-start gap-4">
              {/* Ícono de Check de actualización */}
              <div className="text-success mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              
              {/* Texto de la versión */}
              <div>
                <p className="font-medium text-base-content">El sistema está actualizado</p>
                <p className="text-sm text-base-content/80 mt-1">
                  SOLaR-Chain 1.0.0-beta (Build de integración)
                </p>
                <p className="text-sm text-base-content/60">
                  Entorno: Local (React, Node.js, SQLite)
                </p>
              </div>
            </div>
          </div>

          {/* Pie del modal con botón de cierre y link de ayuda */}
          <div className="px-6 py-4 border-t border-base-300 bg-base-100 flex justify-between items-center">
            {/* Link falso para simular el "Obtener ayuda" */}
            <a href="#" className="text-sm text-primary hover:underline flex items-center gap-1">
              Obtener ayuda de SOLaR
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            
            <form method="dialog">
              <button className="btn btn-sm btn-ghost">Cerrar</button>
            </form>
          </div>

        </div>
        
        {/* Backdrop para cerrar haciendo clic afuera */}
        <form method="dialog" className="modal-backdrop">
          <button>cerrar</button>
        </form>
      </dialog>

      
     {/*----------------------------------------------------------------*/}




      
    </div>



    
  );
  
}