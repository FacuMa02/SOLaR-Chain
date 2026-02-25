export default function SideDrawer({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997]">
      {/* overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-base-100 shadow-xl p-5 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
