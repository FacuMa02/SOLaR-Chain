import { useMemo, useState, useEffect, useRef } from "react";
import { STAGES, VIRTUAL_STAGES } from "../data/stages";
import LoteCard from "../components/LoteCard";
import ConfirmModal from "../components/ConfirmModal";
import SideDrawer from "../components/SideDrawer";

import * as lotesSvc from "../services/lotesService";

export default function ProcesoProductivo({ toast }) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [cantidadDescontar, setCantidadDescontar] = useState("");
  const [quienRetira, setQuienRetira] = useState("");
  const [isSubmittingDescuento, setIsSubmittingDescuento] = useState(false);
  const submitLock = useRef(false);
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

  const byStage = useMemo(() => {
    const map = new Map();
    STAGES.forEach((_, i) => map.set(i, []));
    for (const l of lotes) {
      if (l.stageIndex === 6 && typeof l.litrosRestantes === "number" && l.litrosRestantes <= 0) continue;
      map.get(l.stageIndex)?.push(l);
    }

    for (const [k, arr] of map) {
      arr.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
      map.set(k, arr);
    }
    return map;
  }, [lotes]);

  function onDragStart(e, lote) {
    // No permitir arrastrar lotes en etapas virtuales (Venta)
    if (VIRTUAL_STAGES.has(lote.stageIndex)) {
      e.preventDefault();
      return;
    }
    setDrag({
      loteId: String(lote.id),
      fromIndex: lote.stageIndex,
      blockchainId: lote.blockchainId,
      codigoLote: lote.codigo,
    });
    e.dataTransfer.setData("text/plain", String(lote.id));
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

    // No se puede soltar en la columna virtual Venta
    if (VIRTUAL_STAGES.has(toIndex)) {
      toast.error("Los lotes llegan a Venta automáticamente al clasificarse como Lampante.");
      setDrag(null);
      return;
    }

    const fromIndex = drag.fromIndex;
    const lote = lotes.find((item) => String(item.id) === loteId);

    // Si se suelta en la misma sección, ignorar silenciosamente para evitar
    // peticiones de validación innecesarias en el backend.
    if (toIndex === fromIndex) {
      setDrag(null);
      return;
    }

    if (toIndex !== fromIndex + 1) {
      const blockchainId = drag?.blockchainId || lote?.blockchainId || lote?.idBlockchain || null;
      const motivo = `Intento inválido: ${STAGES[fromIndex]} -> ${STAGES[toIndex]}. Solo se permite avanzar a la etapa siguiente.`;

      if (blockchainId) {
        lotesSvc
          .reportInvalidTransition(blockchainId, toIndex, motivo)
          .then(() => toast.error("Error: Transición inválida"))
          .catch((err) => toast.error(err.message || "No se pudo registrar el movimiento inválido."));
      } else {
        toast.error("Movimiento inválido: solo se permite avanzar a la etapa siguiente.");
      }

      setDrag(null);
      return;
    }

    setConfirm({
      loteId,
      fromIndex,
      toIndex,
      blockchainId: drag.blockchainId,
      codigoLote: drag.codigoLote,
      maxKg: lote?.kg,
    });
    setDrag(null);
  }

  function openDetail(lote) {
    setSelected(lote);
    setDrawerOpen(true);
  }

  async function confirmMove(formData) {
    if (!confirm) return;
    const { loteId, toIndex } = confirm;

    // Interfaz de usuario optimista
    const prev = lotes;
    const next = lotes.map((l) => (String(l.id) === String(loteId) ? { ...l, stageIndex: toIndex } : l));
    setLotes(next);

    setConfirmLoading(true);
    try {
      const blockchainId = confirm.blockchainId;
      const codigoLote = confirm.codigoLote;

      if (!blockchainId || !codigoLote) {
        throw new Error("No se encontró el identificador en blockchain para este lote.");
      }

      await lotesSvc.advanceStage(blockchainId, toIndex, {
        codigoLote,
        kgAceiteNeto: formData.kgAceiteNeto,
        acidez: formData.acidez,
        peroxidos: formData.peroxidos,
      });

      // Refrescar el tablero desde el backend para asegurar que el lote
      // quede en la columna correcta y obtener estados actualizados.
      try {
        const refreshed = await lotesSvc.fetchTablero();
        setLotes(refreshed);
      } catch (refreshErr) {
        // Si falla el refresco, no interrumpimos la experiencia de usuario — ya hicimos el cambio optimista.
        console.warn("No se pudo refrescar el tablero:", refreshErr);
      }

      toast.success("Lote actualizado en blockchain");
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

  async function handleDescontar(cantidad, quien) {
    if (!selected) return;
    if (submitLock.current) return;
    
    const amount = Number(cantidad);
    if (!cantidad || Number.isNaN(amount) || amount <= 0) {
      toast.error("Ingrese una cantidad válida de litros.");
      return;
    }
    if (!quien || !quien.trim()) {
      toast.error("Ingrese quién retira el aceite.");
      return;
    }

    submitLock.current = true;
    setIsSubmittingDescuento(true);
    try {
      const url = `${API_BASE}/api/produccion/descontar`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lote_id: selected.id, deposito_id: 1, cantidad: amount, quien_retira: quien.trim() }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || "Respuesta inválida del servidor");
      }

      if (!data.success) throw new Error(data.error || data.message || "Error al descontar litros");

      toast.success("Litros descontados");
      setCantidadDescontar("");
      setQuienRetira("");
      // recargar lotes y actualizar detalle
      const refreshed = await lotesSvc.fetchTablero();
      setLotes(refreshed);
      const updated = refreshed.find((l) => l.id === selected.id);
      if (updated) setSelected(updated);
    } catch (err) {
      toast.error(err.message);
    } finally {
      submitLock.current = false;
      setIsSubmittingDescuento(false);
    }
  }

  // cargar datos iniciales al montar
  useEffect(() => {
    setLoading(true);
    lotesSvc.fetchTablero().then(setLotes).catch((err) => {
      toast.error(err.message || "Error cargando datos");
    }).finally(() => setLoading(false));
  }, [toast]);

  return (
    
    <div className="h-full w-full p-4 flex flex-col">
      <div className="bg-base-100 rounded-2xl shadow p-5 flex flex-col flex-1 min-h-0">
        {loading && <div className="mb-2 text-sm text-base-content/70">Cargando lotes…</div>}
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Proceso Productivo</h1>
          <p className="text-sm text-base-content/70">
           Arrastre solo a la etapa siguiente.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 w-max h-full pb-2">
            {STAGES.map((stageName, idx) => {
              const isVenta = VIRTUAL_STAGES.has(idx);
              return (
              <div
                key={stageName}
                className={`w-[320px] shrink-0 rounded-2xl p-3 flex flex-col h-full ${
                  isVenta
                    ? "bg-base-200/50 opacity-60"
                    : "bg-base-200"
                }`}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, idx)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{stageName}</div>
                  <div className="badge badge-outline">{byStage.get(idx)?.length ?? 0}</div>
                </div>

                <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
                  {(byStage.get(idx) || []).map((lote) => (
                    <div key={lote.id} className={isVenta ? "opacity-60" : ""}>
                      <LoteCard
                        lote={lote}
                        stageName={stageName}
                        onClick={openDetail}
                        onDragStart={onDragStart}
                      />
                    </div>
                  ))}

                  {(byStage.get(idx) || []).length === 0 && (
                    <div className="text-sm text-base-content/60 p-3 border border-dashed rounded-xl">
                      Sin lotes en esta etapa
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirmación */}
      <ConfirmModal
        open={!!confirm}
        title={confirm ? `${STAGES[confirm.fromIndex]} → ${STAGES[confirm.toIndex]}` : ""}
        subtitle="¿Confirmar avance de etapa?"
        fromIndex={confirm?.fromIndex}
        toIndex={confirm?.toIndex}
        maxKg={confirm?.maxKg}
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
                {selected.codigo && (
                  <div>
                    <span className="font-medium">Código:</span> {selected.codigo}
                  </div>
                )}
                {selected.variedad && (
                  <div>
                    <span className="font-medium">Variedad:</span> {selected.variedad}
                  </div>
                )}
                {selected.kg !== undefined && (
                  <div>
                    <span className="font-medium">KG:</span> {selected.kg}
                  </div>
                )}
                {selected.estado && (
                  <div>
                    <span className="font-medium">Estado:</span> {selected.estado}
                  </div>
                )}
                {selected.rendimiento !== null && selected.rendimiento !== undefined && Number(selected.rendimiento) > 0 && (
                  <div>
                    <span className="font-medium">Rendimiento industrial (RI):</span> {selected.rendimiento}%
                  </div>
                )}
                {selected.kgAceiteNeto ? (
                  <div>
                    <span className="font-medium">Litros estimados:</span> {(selected.kgAceiteNeto / 0.916).toFixed(2)} L
                  </div>
                ) : (
                  selected.kg !== undefined && selected.rendimiento !== null && selected.rendimiento !== undefined && (
                    <div>
                      <span className="font-medium">Litros estimados:</span> {((selected.kg * (selected.rendimiento / 100)) / 0.916).toFixed(2)} L
                    </div>
                  )
                )}
                {selected.acidez !== null && selected.acidez !== undefined && (
                  <div>
                    <span className="font-medium">Acidez:</span> {selected.acidez}%
                  </div>
                )}
                {selected.peroxidos !== null && selected.peroxidos !== undefined && (
                  <div>
                    <span className="font-medium">Peróxidos:</span> {selected.peroxidos} meq O₂/kg
                  </div>
                )}
                <div>
                  <span className="font-medium">Etapa actual:</span>{" "}
                  {STAGES[selected.stageIndex] || "—"}
                </div>
              </div>
            </div>

            <button className="btn btn-outline w-full" disabled title="(Opcional) editar en el futuro">
              Editar
            </button>

            {selected.stageIndex === 6 && (
              <div className="rounded-2xl border p-4 space-y-2">
                <div className="font-semibold">Descontar Litros</div>
                <div className="text-sm space-y-1">
                  <div>
                    Litros restantes: {((selected.litrosRestantes !== null && selected.litrosRestantes !== undefined ? selected.litrosRestantes : (selected.kgAceiteNeto ? selected.kgAceiteNeto / 0.916 : ((selected.kg * (selected.rendimiento / 100)) / 0.916))) || 0).toFixed(2)} L
                  </div>
                  <input type="number" placeholder="Cantidad" value={cantidadDescontar} onChange={(e) => setCantidadDescontar(e.target.value)} className="input input-bordered w-full" />
                  <input type="text" placeholder="¿Quién retira?" value={quienRetira} onChange={(e) => setQuienRetira(e.target.value)} className="input input-bordered w-full" />
                  <button className="btn btn-primary w-full" onClick={() => handleDescontar(cantidadDescontar, quienRetira)} disabled={!cantidadDescontar || !quienRetira.trim() || isSubmittingDescuento}>
                    {isSubmittingDescuento ? "Descontando..." : "Descontar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
