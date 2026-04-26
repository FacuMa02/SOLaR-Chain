export default function ToastHost({ toasts }) {
  return (
    <div className="toast toast-top toast-end z-[9999]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${t.type === "error" ? "alert-error" : "alert-success"}`}
        >
          <span className="text-sm">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
