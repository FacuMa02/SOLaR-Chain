// Fondo por calidad usando estilos inline para asegurar visibilidad.
function calidadBgStyle(calidad) {
  if (!calidad) return { backgroundColor: "var(--fallback-b1,oklch(var(--b1)/1))" };
  const c = calidad.toLowerCase();

  // En etapas iniciales no hay clasificación de calidad final.
  if (c.includes("transito ok") || c.includes("pendiente")) {
    return { backgroundColor: "var(--fallback-b1,oklch(var(--b1)/1))" };
  }

  if (c.includes("extra virgen")) return { backgroundColor: "#272b00" };
  if (c.includes("virgen")) return { backgroundColor: "#54582f" };
  if (c.includes("corriente")) return { backgroundColor: "#86895d" };
  if (c.includes("oliva")) return { backgroundColor: "#bec092" };
  if (c.includes("refinado")) return { backgroundColor: "#6b4f00" };
  if (c.includes("lampante") || c.includes("no apto")) return { backgroundColor: "red" };

  // Fallback neutro para cualquier observación no catalogada.
  return { backgroundColor: "var(--fallback-b1,oklch(var(--b1)/1))" };
}

function formatoCalidad(calidad) {
  if (!calidad) return "";
  return calidad.trim();
}

function mostrarCalidad(calidad) {
  if (!calidad) return false;
  const c = calidad.toLowerCase();
  return (
    c.includes("extra virgen") ||
    c.includes("virgen") ||
    c.includes("oliva") ||
    c.includes("corriente") ||
    c.includes("lampante") ||
    c.includes("refinado") ||
    c.includes("no apto")
  );
}

export default function LoteCard({ lote, stageName, onClick, onDragStart }) {
  const colorStyle = calidadBgStyle(lote.calidad);
  const calidadTexto = formatoCalidad(lote.calidad);
  const debeMostrarCalidad = mostrarCalidad(lote.calidad);
  return (
    <div
      className="card border shadow-sm cursor-pointer hover:shadow transition"
      style={colorStyle}
      draggable
      onDragStart={(e) => onDragStart(e, lote)}
      onClick={() => onClick(lote)}
      title="Click para ver detalle"
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold">{lote.codigo}</div>
          <span className="badge badge-outline">{stageName}</span>
        </div>

        <div className="text-sm text-base-content/70 space-y-1 mt-1">
          <div>
            <span className="font-medium">Variedad:</span> {lote.variedad}
          </div>
          <div>
            <span className="font-medium">KG:</span> {lote.kg}
          </div>
          {lote.rendimiento !== null && lote.rendimiento !== undefined && Number(lote.rendimiento) > 0 && (
            <div>
              <span className="font-medium">Rend. industrial (RI):</span> {lote.rendimiento}%
            </div>
          )}
          <div>
            <span className="font-medium">Recepción:</span> {lote.fechaInicio}
          </div>
        </div>

        <div className="mt-2 text-xs text-base-content/60">
          Estado: {lote.estado}
        </div>

        {debeMostrarCalidad && (
          <div className="mt-1 text-xs font-medium text-base-content/80">
            Resultado blockchain: {calidadTexto}
          </div>
        )}
      </div>
    </div>
  );
}
