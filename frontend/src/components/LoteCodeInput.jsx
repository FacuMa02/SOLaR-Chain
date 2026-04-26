import { useEffect, useState } from "react";

function getCurrentYear() {
  return new Date().getFullYear();
}

export function getLotePrefix(year = getCurrentYear()) {
  return `LOT-${year}-`;
}

export function buildCodigoLote(rawCodigoLote, year = getCurrentYear()) {
  const lotePrefix = getLotePrefix(year);
  const normalizedCodigo = String(rawCodigoLote || "").trim();

  if (!normalizedCodigo) {
    return "";
  }

  if (normalizedCodigo.startsWith(lotePrefix)) {
    return normalizedCodigo;
  }

  return `${lotePrefix}${normalizedCodigo}`;
}

export default function LoteCodeInput({
  value,
  onChange,
  error,
  label = "Código de lote *",
  placeholder = "Ej: 001",
}) {
  const [currentYear, setCurrentYear] = useState(() => getCurrentYear());

  useEffect(() => {
    setCurrentYear(getCurrentYear());
  }, []);

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <div className="flex flex-row items-center">
        <label className="label">
          <span className="label-text rounded-l-lg border border-base-300 bg-base-200 px-3 py-3 text-base-content/80">
            {getLotePrefix(currentYear)}
          </span>
        </label>
        <input
          className={`input input-bordered ${error ? "input-error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      {error && <span className="text-xs text-error mt-1">{error}</span>}
    </div>
  );
}