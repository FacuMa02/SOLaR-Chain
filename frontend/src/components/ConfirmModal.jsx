export default function ConfirmModal({ open, title, subtitle, onConfirm, onCancel, loading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-base-100 rounded-2xl shadow p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm text-base-content/70">{subtitle}</p> : null}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
