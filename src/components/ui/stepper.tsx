import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import { useApp } from "@/app/app-context";
import { cn } from "@/lib/utils";

type StepperProps = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** zugänglicher Name, z. B. "Wiederholungen Satz 1" */
  label: string;
  step?: number;
  min?: number;
  max?: number;
  /** Dezimalstellen erlauben (Gewicht) */
  decimal?: boolean;
  unit?: string;
  size?: "md" | "lg";
  disabled?: boolean;
  className?: string;
};

function format(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100).replace(".", ",");
}

function parse(text: string): number | undefined {
  const normalized = text.replace(",", ".").trim();
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** − Wert + : schnelles Ändern ohne Dialog, Wert auch direkt editierbar */
export function Stepper({
  value,
  onChange,
  label,
  step = 1,
  min = 0,
  max = 9999,
  decimal = false,
  unit,
  size = "md",
  disabled,
  className,
}: StepperProps) {
  const { t } = useApp();
  const inputId = useId();
  // Während der Eingabe zählt der Entwurf, sonst immer der aktuelle Wert.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format(value);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const bump = (direction: 1 | -1) => onChange(clamp((value ?? 0) + direction * step));

  const buttonClass = cn(
    "flex shrink-0 items-center justify-center rounded-full bg-elevated text-fg transition active:scale-95 active:bg-[#26262a] disabled:opacity-30",
    size === "lg" ? "h-12 w-12" : "h-11 w-11",
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => bump(-1)}
        disabled={disabled || (value ?? 0) <= min}
        aria-label={t("common.decrease", { label })}
      >
        <Minus size={18} strokeWidth={2.5} aria-hidden />
      </button>
      <div className="relative min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          inputMode={decimal ? "decimal" : "numeric"}
          enterKeyHint="done"
          autoComplete="off"
          value={shown}
          disabled={disabled}
          onFocus={(e) => {
            setDraft(format(value));
            e.currentTarget.select();
          }}
          onBlur={() => {
            const parsed = parse(shown);
            setDraft(null);
            onChange(parsed == null ? undefined : clamp(decimal ? parsed : Math.round(parsed)));
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={cn(
            "tabular w-full rounded-xl bg-transparent text-center font-black text-fg outline-none focus:bg-elevated",
            size === "lg" ? "h-12 text-2xl" : "h-11 text-xl",
          )}
          placeholder="–"
        />
        {unit && (
          <span className="pointer-events-none absolute inset-x-0 -bottom-3 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">
            {unit}
          </span>
        )}
      </div>
      <button
        type="button"
        className={buttonClass}
        onClick={() => bump(1)}
        disabled={disabled || (value ?? 0) >= max}
        aria-label={t("common.increase", { label })}
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
