import React, { useState, useEffect, useCallback } from 'react';
import * as lotesSvc from '../services/lotesService';

export default function Historial({ toast }) {
  const [lotes, setLotes] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Estados para el Modal de borrado
  const [loteToDelete, setLoteToDelete] = useState(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lotesSvc.getHistorial(search, page, 10);
      setLotes(res.data);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page, toast]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1); // Resetear a la página 1 al buscar
    fetchHistorial();
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!password) return toast.error("Ingresa la contraseña");

    setDeleting(true);
    try {
      await lotesSvc.deleteLote(loteToDelete.id, password);
      toast.success("Lote eliminado con éxito");
      setLoteToDelete(null);
      setPassword("");
      fetchHistorial(); // Recargar la tabla
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">Historial de Lotes (Últimos 3 Años)</h1>
        
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Buscar por código o variedad..." 
            className="input input-bordered w-full md:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Buscar</button>
        </form>
      </div>

      <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha Recepción</th>
              <th>Variedad</th>
              <th>KG</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center py-4">Cargando...</td></tr>
            ) : lotes.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-4">No se encontraron lotes.</td></tr>
            ) : (
              lotes.map((lote) => (
                <tr key={lote.id}>
                  <td className="font-semibold">{lote.codigo}</td>
                  <td>{lote.fechaRecepcion}</td>
                  <td>{lote.variedad}</td>
                  <td>{lote.kg} kg</td>
                  <td className="text-right">
                    <button 
                      className="btn btn-error btn-sm"
                      onClick={() => setLoteToDelete(lote)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex justify-between items-center mt-4">
        <button 
          className="btn btn-outline btn-sm" 
          disabled={page <= 1} 
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Página {page} de {totalPages === 0 ? 1 : totalPages}</span>
        <button 
          className="btn btn-outline btn-sm" 
          disabled={page >= totalPages} 
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>

      {/* Modal de confirmación de borrado */}
      {loteToDelete && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">¡Atención! Acción destructiva</h3>
            <p className="py-4">
              Estás a punto de eliminar el lote <strong>{loteToDelete.codigo}</strong> de forma permanente. 
              Por seguridad, ingresa tu contraseña de inicio de sesión para confirmar.
            </p>
            <form onSubmit={confirmDelete}>
              <input 
                type="password" 
                placeholder="Contraseña" 
                className="input input-bordered w-full mb-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={() => {
                  setLoteToDelete(null);
                  setPassword("");
                }} disabled={deleting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-error" disabled={deleting}>
                  {deleting ? "Eliminando..." : "Confirmar Borrado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}