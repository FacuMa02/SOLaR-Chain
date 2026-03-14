function formatDate(value) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function pointClass(resultado) {
  switch (resultado) {
    case "APROBADO":
      return "bg-success";
    case "OBSERVADO":
      return "bg-warning";
    case "NO_CONFORME":
    case "CANCELADO":
    case "TRANSICION_INVALIDA":
      return "bg-error";
    default:
      return "bg-base-content/40";
  }
}

function hasMetric(value) {
  return value !== null && value !== undefined && Number(value) !== 0;
}

export default function HistorialLote({ lote, eventos, loading, error, onExport, exportLoading = false }) {
  const loteBlockchainId = lote?.blockchain_id ?? lote?.blockchainId;

  return (
    <div className="space-y-5">
      <div className="text-sm leading-6">
        <p className="text-xs uppercase tracking-[0.2em] text-base-content/50">Lote</p>
        <p className="text-lg font-semibold">{lote?.codigo || "Sin código"}</p>
        <p className="text-base-content/70">
          {lote?.variedad || "Sin variedad"} · {lote?.kg ?? "-"} kg · Estado: {lote?.estado || "-"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-base-content/50">Trazabilidad</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60">{eventos.length} eventos</span>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={onExport}
            disabled={exportLoading || !loteBlockchainId}
          >
            {exportLoading ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-base-content/60">Cargando historial del lote...</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-base-content/60">No hay eventos registrados para este lote.</p>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-2 top-2 bottom-2 w-[2px] bg-primary/60" />

          <div className="space-y-6">
            {eventos.map((evento, index) => (
              <article key={`${evento.fecha_hora || index}-${evento.etapa}-${evento.resultado}`} className="relative">
                <div className={`absolute -left-8 top-2 h-4 w-4 rounded-full border-2 border-primary ${pointClass(evento.resultado)}`} />

                <p className="text-xs text-base-content/55">{formatDate(evento.fecha_hora)}</p>
                <p className="mt-1 text-sm font-semibold">
                  {evento.etapa} · {evento.resultado}
                </p>
                <p className="mt-1 text-sm text-base-content/80">{evento.motivo || "Sin observaciones"}</p>

                {(hasMetric(evento.rendimiento) || hasMetric(evento.acidez) || hasMetric(evento.peroxidos)) && (
                  <p className="mt-1 text-xs text-base-content/65">
                    {hasMetric(evento.rendimiento) ? `Rendimiento: ${evento.rendimiento} ` : ""}
                    {hasMetric(evento.acidez) ? `Acidez: ${evento.acidez} ` : ""}
                    {hasMetric(evento.peroxidos) ? `Peróxidos: ${evento.peroxidos}` : ""}
                  </p>
                )}

                {evento.tx_hash && (
                  <p className="mt-1 text-xs text-base-content/60">Tx: {evento.tx_hash}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}