import { useMemo, useState } from "react";
import { STAGES } from "../data/stages";
import LoteCard from "../components/LoteCard";
import ConfirmModal from "../components/ConfirmModal";
import SideDrawer from "../components/SideDrawer";

export default function ProcesoProductivo({ lotes, setLotes, api, toast }) {
  const [drag, setDrag] = useState(null);
  const [confirm, setConfirm] = useState(null); 
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const byStage = useMemo(() => {
    const map = new Map();
    STAGES.forEach((_, i) => map.set(i, []));
    for (const l of lotes) map.get(l.stageIndex)?.push(l);

    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      map.set(k, arr);
    }
    return map;
  }, [lotes]);

  function onDragStart(e, lote) {
    setDrag({ loteId: lote.id, fromIndex: lote.stageIndex });
    e.dataTransfer.setData("text/plain", lote.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e, toIndex) {
    e.preventDefault();
    const loteId = e.dataTransfer.getData("text/plain");
    if (!loteId || !drag) return;

    const fromIndex = drag.fromIndex;

    if (toIndex !== fromIndex + 1) {
      toast.error("Movimiento inválido: solo se permite avanzar a la etapa siguiente.");
      setDrag(null);
      return;
    }

    setConfirm({ loteId, fromIndex, toIndex });
    setDrag(null);
  }

  function openDetail(lote) {
    setSelected(lote);
    setDrawerOpen(true);
  }

  async function confirmMove() {
    if (!confirm) return;
    const { loteId, toIndex } = confirm;

    const prev = lotes;
    const next = lotes.map((l) => (l.id === loteId ? { ...l, stageIndex: toIndex } : l));
    setLotes(next);

    setConfirmLoading(true);
    try {
      await api.updateStage(loteId, toIndex);
      toast.success("Lote actualizado");
      setConfirm(null);
    } catch (err) {
      toast.error(err?.message || "No se pudo actualizar el lote.");
      setLotes(prev);
      setConfirm(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  function cancelMove() {
    setConfirm(null);
  }

  return (
    
    <div className="h-full w-full p-4 flex flex-col">
      <div className="bg-base-100 rounded-2xl shadow p-5 flex flex-col flex-1 min-h-0">
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Proceso Productivo</h1>
          <p className="text-sm text-base-content/70">
           Arrastre solo a la etapa siguiente.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 w-max">
            {STAGES.map((stageName, idx) => (
              <div
                key={stageName}
                className="w-[320px] shrink-0 bg-base-200 rounded-2xl p-3 flex flex-col"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, idx)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{stageName}</div>
                  <div className="badge badge-outline">{byStage.get(idx)?.length ?? 0}</div>
                </div>

                <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
                  {(byStage.get(idx) || []).map((lote) => (
                    <LoteCard
                      key={lote.id}
                      lote={lote}
                      stageName={stageName}
                      onClick={openDetail}
                      onDragStart={onDragStart}
                    />
                  ))}

                  {(byStage.get(idx) || []).length === 0 && (
                    <div className="text-sm text-base-content/60 p-3 border border-dashed rounded-xl">
                      Sin lotes en esta etapa
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmación */}
      <ConfirmModal
        open={!!confirm}
        title={confirm ? `${STAGES[confirm.fromIndex]} → ${STAGES[confirm.toIndex]}` : ""}
        subtitle="¿Confirmar avance de etapa?"
        onCancel={cancelMove}
        onConfirm={confirmMove}
        loading={confirmLoading}
      />

      {/* desplagable detalle */}
      <SideDrawer
        open={drawerOpen}
        title={selected ? `Detalle ${selected.codigo}` : "Detalle"}
        onClose={() => setDrawerOpen(false)}
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-2xl border p-4 space-y-2">
              <div className="font-semibold">Descripción</div>

              <div className="text-sm space-y-1">
                <div><span className="font-medium">Fecha:</span> {selected.fechaRecepcion}</div>
                <div><span className="font-medium">Productor:</span> {selected.productor}</div>
                <div><span className="font-medium">Origen:</span> {selected.origen}</div>
                <div><span className="font-medium">Estado:</span> {selected.estado}</div>
                <div>
                  <span className="font-medium">Cajones/Bolsas:</span>{" "}
                  {selected.contenedorTipo}: {selected.contenedorCantidad}
                </div>
                <div><span className="font-medium">Variedad:</span> {selected.variedad}</div>
                <div><span className="font-medium">KG:</span> {selected.kg}</div>
                <div>
                  <span className="font-medium">Etapa actual:</span>{" "}
                  {STAGES[selected.stageIndex] || "—"}
                </div>
              </div>
            </div>

            <button className="btn btn-outline w-full" disabled title="(Opcional) editar en el futuro">
              Editar
            </button>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
