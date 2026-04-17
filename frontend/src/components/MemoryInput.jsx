import { useMemo, useState } from "react";

export default function MemoryInput({
  value,
  onValueChange,
  options,
  placeholder,
  error,
  emptyMessage,
  title = "Valores previos",
}) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const cleanedOptions = [
      ...new Set(options.map((option) => String(option || "").trim()).filter(Boolean)),
    ];
    const search = value.trim().toLowerCase();

    if (!search) {
      return cleanedOptions.slice(0, 6);
    }

    return cleanedOptions.filter((option) => option.toLowerCase().includes(search)).slice(0, 6);
  }, [options, value]);

  const shouldShowDropdown = isOpen && (filteredOptions.length > 0 || value.trim());

  return (
    <div className="relative">
      <input
        className={`input input-bordered w-full ${error ? "input-error" : ""}`}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {shouldShowDropdown && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg">
          <div className="border-b border-base-300 bg-base-200/70 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-base-content/50">
            {title}
          </div>

          {filteredOptions.length > 0 ? (
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredOptions.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-base-content transition hover:bg-base-200"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onValueChange(option);
                      setIsOpen(false);
                    }}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-sm text-base-content/60">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}