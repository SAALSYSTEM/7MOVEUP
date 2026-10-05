import { Check, Minus, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { useApp } from "@/app/app-context";
import { parseDisplayInput, roundTo, type MetricView, type ValueCheck } from "@/domain/body";
import { cn } from "@/lib/utils";

type Props = {
  metric: MetricView;
  /** bestätigter Wert in Anzeigeeinheit; undefined = (noch) nicht erfasst */
  value: number | undefined;
  /** letzter bekannter Wert in Anzeigeeinheit – nur Vorschlag */
  suggestion?: number;
  /** z. B. "zuletzt 75,3 kg · 3. Okt" */
  hint?: string;
  check?: ValueCheck;
  onChange: (value: number | undefined) => void;
};

function toInputText(value: number, decimals: number, comma: boolean) {
  const text = value.toFixed(decimals);
  return comma ? text.replace(".", ",") : text;
}

/**
 * Eine Zeile der Schnellerfassung: − Wert +, Zahl direkt antippbar.
 * Der letzte Wert erscheint grau als Vorschlag und wird erst gespeichert, wenn er bestätigt
 * (✓, Enter), mit − / + verändert oder neu eingetippt wurde.
 */
export function MetricInput({ metric, value, suggestion, hint, check = "ok", onChange }: Props) {
  const { t, language } = useApp();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = value !== undefined;
  const base = value ?? suggestion;
  const comma = language === "de";

  const shown =
    draft ?? (base !== undefined ? toInputText(roundTo(base, metric.decimals), metric.decimals, comma) : "");

  const bump = (direction: 1 | -1) => {
    // noch kein Wert (erste Erfassung): − / + öffnen direkt die Eingabe
    if (base === undefined) return inputRef.current?.focus();
    onChange(Math.max(0, roundTo(base + direction * metric.step, metric.decimals)));
  };

  const commit = () => {
    if (typed && draft !== null) {
      const parsed = parseDisplayInput(draft);
      onChange(parsed === undefined ? undefined : roundTo(parsed, Math.max(metric.decimals, 2)));
    }
    setDraft(null);
    setTyped(false);
  };

  const buttonClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-fg transition active:scale-95 active:bg-[#26262a] disabled:opacity-30";

  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="truncate text-sm font-bold">
          {metric.name}
        </label>
        {hint && <span className="shrink-0 text-[11px] font-semibold text-subtle">{hint}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={buttonClass}
          onClick={() => bump(-1)}
          aria-label={t("common.decrease", { label: metric.name })}
        >
          <Minus size={18} strokeWidth={2.5} aria-hidden />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id={id}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={shown}
            placeholder={t("body.enterValue")}
            onFocus={(e) => {
              setDraft(shown);
              setTyped(false);
              e.currentTarget.select();
            }}
            onChange={(e) => {
              setDraft(e.target.value.replace(/[^\d.,]/g, ""));
              setTyped(true);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (!typed && !confirmed && suggestion !== undefined) onChange(suggestion);
              e.currentTarget.blur();
            }}
            aria-describedby={`${id}-state`}
            className={cn(
              "tabular h-12 w-full rounded-xl bg-white/[0.04] text-center text-2xl font-black outline-none ring-1 ring-inset ring-line placeholder:text-sm placeholder:font-semibold placeholder:text-subtle focus:bg-elevated focus:ring-accent/50",
              confirmed || draft !== null ? "text-fg" : "text-subtle",
            )}
          />
          {metric.unit && (
            <span className="pointer-events-none absolute inset-x-0 -bottom-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">
              {metric.unit}
            </span>
          )}
        </div>
        <button
          type="button"
          className={buttonClass}
          onClick={() => bump(1)}
          aria-label={t("common.increase", { label: metric.name })}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
        </button>
        {confirmed ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-white/5 hover:text-fg"
            aria-label={t("body.clearValue", { name: metric.name })}
          >
            <X size={18} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => suggestion !== undefined && onChange(suggestion)}
            disabled={suggestion === undefined}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:text-fg disabled:invisible"
            aria-label={t("body.takeSuggestion", { name: metric.name })}
          >
            <Check size={18} aria-hidden />
          </button>
        )}
      </div>
      <p id={`${id}-state`} className="sr-only">
        {confirmed ? t("body.stateSet") : suggestion !== undefined ? t("body.stateSuggestion") : t("body.stateEmpty")}
      </p>
      {check === "unusual" && <p className="mt-3 text-xs font-semibold text-accent-light">{t("body.unusual")}</p>}
      {check === "invalid" && <p className="mt-3 text-xs font-semibold text-danger">{t("body.invalid")}</p>}
    </div>
  );
}
