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

function parseMotivo(motivo) {
  if (!motivo) {
    return {
      descripcion: "Sin observaciones",
      metricas: {},
    };
  }

  if (typeof motivo !== "string") {
    return {
      descripcion: String(motivo),
      metricas: {},
    };
  }

  try {
    const parsed = JSON.parse(motivo);
    if (!parsed || typeof parsed !== "object") {
      return {
        descripcion: motivo,
        metricas: {},
      };
    }

    return {
      descripcion: parsed.motivo || "Sin observaciones",
      metricas: {
        rendimiento: parsed.rendimiento,
        kgAceiteNeto: parsed.kgAceiteNeto,
        acidez: parsed.acidez,
        peroxidos: parsed.peroxidos,
      },
    };
  } catch {
    return {
      descripcion: motivo,
      metricas: {},
    };
  }
}

function AuditoriaBadge({ auditoria, auditando }) {
  if (auditando) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-xs text-base-content/60">
        <span className="loading loading-spinner loading-xs" />
        Verificando integridad...
      </div>
    );
  }

  if (!auditoria || auditoria.estado === "SIN_SINCRONIZAR") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-xs text-base-content/50">
        <span>⬜</span> Sin sincronizar con blockchain
      </div>
    );
  }

  if (auditoria.esValido) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
        <span>✔</span> Integridad verificada — datos íntegros
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-error/50 bg-error/10 px-3 py-2 text-xs text-error">
      <span className="font-semibold">⚠ ALERTA: datos alterados</span>
      {auditoria.detalles && (
        <span className="break-all text-error/70">
          Hash local: {auditoria.detalles.hashLocalRecalculado}<br />
          Hash blockchain: {auditoria.detalles.hashBlockchain}
        </span>
      )}
    </div>
  );
}

export default function HistorialLote({ lote, eventos, loading, error, onExport, exportLoading = false, auditoria = null, auditando = false }) {
  const loteSqliteId = lote?.id;

  return (
    <div className="space-y-5">
      <div className="text-sm leading-6">
        <p className="text-xs uppercase tracking-[0.2em] text-base-content/50">Lote</p>
        <p className="text-lg font-semibold">{lote?.codigo || "Sin código"}</p>
        <p className="text-base-content/70">
          {lote?.variedad || "Sin variedad"} · {lote?.kg ?? "-"} kg · Estado: {lote?.estado || "-"}
        </p>
      </div>

      <AuditoriaBadge auditoria={auditoria} auditando={auditando} />

      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-base-content/50">Trazabilidad</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60">{eventos.length} eventos</span>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={onExport}
            disabled={exportLoading || !loteSqliteId}
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
            {eventos.map((evento, index) => {
              const motivoFormateado = parseMotivo(evento.motivo);
              const metricas = {
                rendimiento: evento.rendimiento ?? motivoFormateado.metricas.rendimiento,
                kgAceiteNeto: motivoFormateado.metricas.kgAceiteNeto,
                acidez: evento.acidez ?? motivoFormateado.metricas.acidez,
                peroxidos: evento.peroxidos ?? motivoFormateado.metricas.peroxidos,
              };

              return (
                <article key={`${evento.fecha_hora || index}-${evento.etapa}-${evento.resultado}`} className="relative">
                  <div className={`absolute -left-8 top-2 h-4 w-4 rounded-full border-2 border-primary ${pointClass(evento.resultado)}`} />

                  <p className="text-xs text-base-content/55">{formatDate(evento.fecha_hora)}</p>
                  <p className="mt-1 text-sm font-semibold">
                    {evento.etapa} · {evento.resultado}
                  </p>
                  <p className="mt-1 text-sm text-base-content/80">{motivoFormateado.descripcion}</p>

                  {(hasMetric(metricas.rendimiento) || hasMetric(metricas.kgAceiteNeto) || hasMetric(metricas.acidez) || hasMetric(metricas.peroxidos)) && (
                    <p className="mt-1 text-xs text-base-content/65">
                      {hasMetric(metricas.rendimiento) ? `Rendimiento: ${metricas.rendimiento} ` : ""}
                      {hasMetric(metricas.kgAceiteNeto) ? `Kg aceite neto: ${metricas.kgAceiteNeto} ` : ""}
                      {hasMetric(metricas.acidez) ? `Acidez: ${metricas.acidez} ` : ""}
                      {hasMetric(metricas.peroxidos) ? `Peróxidos: ${metricas.peroxidos}` : ""}
                    </p>
                  )}

                  {evento.tx_hash && (
                    <p className="mt-1 text-xs text-base-content/60">Tx: {evento.tx_hash}</p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}