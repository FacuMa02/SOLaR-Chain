import { useState, useEffect, useCallback } from 'react';
import * as lotesSvc from '../services/lotesService';
import SideDrawer from '../components/SideDrawer';
import HistorialLote from '../components/HistorialLote';

export default function Historial({ toast }) {
  const [lotes, setLotes] = useState([]);
  const [search, setSearch] = useState("");
  const [currentSearch, setCurrentSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");

  const fetchHistorial = useCallback(async (searchTerm = "", pageNum = 1) => {
    setLoading(true);
    try {
      const res = await lotesSvc.getHistorial(searchTerm, pageNum, 10);
      setLotes(res.data);
      setTotalPages(res.totalPages);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHistorial(currentSearch, page);
  }, [currentSearch, page, fetchHistorial]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentSearch(search);
    setPage(1); // Resetear a la página 1 al buscar
  };

  const handleOpenTimeline = async (lote) => {
    setSelectedLote(lote);
    setTimelineEvents([]);
    setTimelineError("");
    setTimelineLoading(true);

    try {
      const eventos = await lotesSvc.getLoteTimeline(lote.blockchain_id);
      setTimelineEvents(eventos);
    } catch (err) {
      setTimelineError(err.message || "No se pudo cargar el historial del lote.");
      toast.error(err.message || "No se pudo cargar el historial del lote.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleCloseTimeline = () => {
    setSelectedLote(null);
    setTimelineEvents([]);
    setTimelineError("");
    setTimelineLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold">Historial de Lotes (Últimos 3 Años)</h1>
        
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Buscar por código de lote..." 
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-4">Cargando...</td></tr>
            ) : lotes.length === 0 ? (
              <tr><td colSpan="4" className="text-center py-4">No se encontraron lotes.</td></tr>
            ) : (
              lotes.map((lote) => (
                <tr
                  key={lote.id}
                  className="cursor-pointer transition hover:bg-base-200"
                  onClick={() => handleOpenTimeline(lote)}
                >
                  <td className="font-semibold">{lote.codigo}</td>
                  <td>{lote.fechaRecepcion}</td>
                  <td>{lote.variedad}</td>
                  <td>{lote.kg} kg</td>
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

      <SideDrawer
        open={!!selectedLote}
        title={selectedLote ? `Trazabilidad ${selectedLote.codigo}` : "Trazabilidad"}
        onClose={handleCloseTimeline}
      >
        <HistorialLote
          lote={selectedLote}
          eventos={timelineEvents}
          loading={timelineLoading}
          error={timelineError}
        />
      </SideDrawer>
    </div>
  );
}