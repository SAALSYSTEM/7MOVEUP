import { useId, useState } from "react";

import { cn } from "@/lib/utils";

type NumberFieldProps = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
};

/** Kompaktes Zahlenfeld für Formulare (Komma oder Punkt erlaubt). */
export function NumberField({ label, value, onChange, min = 0, max = 99999, decimal, placeholder, className }: NumberFieldProps) {
  const id = useId();
  const formatted = value == null ? "" : String(value).replace(".", decimal ? "," : ".");
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatted;

  const commit = (text: string) => {
    const normalized = text.replace(",", ".").trim();
    if (!normalized) return onChange(undefined);
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return onChange(undefined);
    const clamped = Math.min(max, Math.max(min, decimal ? parsed : Math.round(parsed)));
    onChange(clamped);
  };

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block truncate text-[11px] font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode={decimal ? "decimal" : "numeric"}
        autoComplete="off"
        value={shown}
        placeholder={placeholder ?? "–"}
        onFocus={() => setDraft(formatted)}
        onBlur={() => {
          commit(shown);
          setDraft(null);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        className="tabular h-11 w-full rounded-xl border border-line bg-elevated px-3 text-[16px] font-bold text-fg outline-none placeholder:text-subtle focus:border-accent/70"
      />
    </div>
  );
}
