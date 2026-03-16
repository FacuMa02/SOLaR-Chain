import { useCallback, useEffect, useState } from "react";
import SideDrawer from "../components/SideDrawer";
import * as remitosSvc from "../services/remitosService";

function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function GetRemitos({ toast }) {
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRemito, setSelectedRemito] = useState(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  const fetchRemitos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await remitosSvc.getRemitos();
      setRemitos(data);
    } catch (err) {
      toast.error(err.message || "No se pudieron cargar los remitos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRemitos();
  }, [fetchRemitos]);

  const handleSelectRemito = async (remitoId) => {
    setLoadingSelected(true);
    try {
      const remito = await remitosSvc.getRemitoById(remitoId);
      setSelectedRemito(remito);
    } catch (err) {
      toast.error(err.message || "No se pudo cargar el remito seleccionado.");
    } finally {
      setLoadingSelected(false);
    }
  };

  const handleClose = () => {
    setSelectedRemito(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Remitos</h1>
        <button type="button" className="btn btn-outline" onClick={fetchRemitos} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
        <table className="table table-zebra w-full">
          <thead className="bg-[#6b8e23] text-white">
            <tr>
              <th>ID</th>
              <th>Fecha recepción</th>
              <th>Productor</th>
              <th>Origen</th>
              <th>Variedad</th>
              <th>KG</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-4">Cargando...</td>
              </tr>
            ) : remitos.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4">No hay remitos cargados.</td>
              </tr>
            ) : (
              remitos.map((remito) => (
                <tr
                  key={remito.id}
                  className="cursor-pointer transition hover:bg-base-200"
                  onClick={() => handleSelectRemito(remito.id)}
                >
                  <td className="font-semibold">#{remito.id}</td>
                  <td>{formatDate(remito.fechaRecepcion)}</td>
                  <td>{remito.productor}</td>
                  <td>{remito.origen}</td>
                  <td>{remito.variedad}</td>
                  <td>{remito.kg} kg</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={!!selectedRemito || loadingSelected}
        title={selectedRemito ? `Remito #${selectedRemito.id}` : "Detalle de remito"}
        onClose={handleClose}
      >
        {loadingSelected ? (
          <p className="text-sm text-base-content/70">Cargando detalle...</p>
        ) : !selectedRemito ? (
          <p className="text-sm text-base-content/70">Seleccione un remito para ver su detalle.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold">Fecha recepción:</span> {formatDate(selectedRemito.fechaRecepcion)}</p>
            <p><span className="font-semibold">Productor:</span> {selectedRemito.productor}</p>
            <p><span className="font-semibold">Origen:</span> {selectedRemito.origen}</p>
            <p><span className="font-semibold">Estado:</span> {selectedRemito.estado}</p>
            <p><span className="font-semibold">Contenedor:</span> {selectedRemito.contenedorCantidad} {selectedRemito.contenedorTipo}</p>
            <p><span className="font-semibold">Variedad:</span> {selectedRemito.variedad}</p>
            <p><span className="font-semibold">Peso:</span> {selectedRemito.kg} kg</p>
            <p><span className="font-semibold">Creado:</span> {formatDate(selectedRemito.createdAt)}</p>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}