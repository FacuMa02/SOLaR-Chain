export default function LoteCard({ lote, stageName, onClick, onDragStart }) {
  return (
    <div
      className="card bg-base-100 border shadow-sm cursor-pointer hover:shadow transition"
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
          <div>
            <span className="font-medium">Recepción:</span> {lote.fechaInicio}
          </div>
        </div>

        <div className="mt-2 text-xs text-base-content/60">
          Estado: {lote.estado}
        </div>
      </div>
    </div>
  );
}
