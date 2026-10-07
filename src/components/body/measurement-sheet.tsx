import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useApp } from "@/app/app-context";
import { MetricInput } from "@/components/body/metric-input";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { bodyRepository } from "@/data";
import { checkValue, formatMetric, fromDisplay, roundTo, toDisplay, type MetricView } from "@/domain/body";
import { latestPoint } from "@/domain/body-stats";
import { entryTitle, type MeasureEntry } from "@/domain/measure-plans";
import type { BodyMeasurement } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { useToday } from "@/hooks/use-today";
import { dateLocale, localDateKey, parseDateKey } from "@/lib/dates";
import { dismissKeyboard } from "@/lib/viewport";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Tag der Messung (yyyy-MM-dd), Standard: heute */
  date?: string;
  /** Eintrag eines Messplans: nur dessen Messwerte, Tag fest. Ohne Eintrag: freie Messung mit allen aktiven Werten. */
  entry?: MeasureEntry;
};

/** Erfassung der Körperwerte – für einen Messplan-Eintrag oder frei („Jetzt messen“). */
export function MeasurementSheet({ open, onClose, date, entry }: Props) {
  const { t } = useApp();
  const today = localDateKey(useToday());
  const [day, setDay] = useState(date ?? today);
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  // beim Öffnen auf den gewünschten Tag springen (ohne Effekt)
  const openKey = open ? (date ?? today) : null;
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (openKey) setDay(openKey);
  }

  const body = useBodyData();
  const existing = useMemo(
    () =>
      entry
        ? body.measurements.find((m) => m.id === entry.measurement?.id)
        : body.measurements.filter((m) => m.date === day && !m.planId).at(-1),
    [body.measurements, day, entry],
  );

  const close = () => {
    dismissKeyboard();
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={entry ? entryTitle(entry, t("calendar.legendBody")) : t("body.captureTitle")}
      description={t("body.captureHint")}
      tall
    >
      {body.loaded && (
        <MeasurementForm
          key={`${day}-${existing?.id ?? "new"}-${entry?.key ?? "free"}`}
          day={day}
          entry={entry}
          today={today}
          onDayChange={setDay}
          existing={existing}
          measurements={body.measurements}
          metrics={body.metrics}
          onDone={close}
        />
      )}
    </Sheet>
  );
}

type Entry = { base: number; display: number };

function MeasurementForm({
  day,
  entry,
  today,
  onDayChange,
  existing,
  measurements,
  metrics,
  onDone,
}: {
  day: string;
  entry?: MeasureEntry;
  today: string;
  onDayChange: (day: string) => void;
  existing: BodyMeasurement | undefined;
  measurements: BodyMeasurement[];
  metrics: MetricView[];
  onDone: () => void;
}) {
  const { t, language } = useApp();
  const toast = useToast();
  const locale = dateLocale(language);
  const [time, setTime] = useState(() =>
    existing ? (existing.time ?? "") : day === today ? format(new Date(), "HH:mm") : "",
  );
  // Bestätigte Werte: Basiswert (ungerundet) + Anzeigewert. Vorhandene Werte bleiben unverändert erhalten.
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      Object.entries(existing?.values ?? {}).flatMap(([key, base]) => {
        const metric = metrics.find((m) => m.key === key);
        return metric ? [[key, { base, display: roundTo(toDisplay(metric, base), metric.decimals) }]] : [];
      }),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // aktive Messwerte + inaktive, die in dieser Messung schon einen Wert haben
  const planKeys = entry?.metricKeys;
  const shown = metrics.filter(
    (m) => (m.enabled && (!planKeys || planKeys.includes(m.key))) || existing?.values[m.key] !== undefined,
  );

  const suggestions = useMemo(
    () =>
      new Map(
        shown.map((metric) => [metric.key, latestPoint(measurements, metric.key, { upToDate: day, excludeId: existing?.id })]),
      ),
    [shown, measurements, day, existing?.id],
  );

  const setValue = (metric: MetricView, display: number | undefined) => {
    setEntries((prev) => {
      const next = { ...prev };
      if (display === undefined) delete next[metric.key];
      else next[metric.key] = { display, base: fromDisplay(metric, display) };
      return next;
    });
  };

  const checks = new Map(shown.map((m) => [m.key, entries[m.key] ? checkValue(m, entries[m.key].base) : "ok"] as const));
  const invalid = [...checks.values()].includes("invalid");
  const count = Object.keys(entries).length;

  const save = async () => {
    dismissKeyboard();
    if (invalid || saving) return;
    setSaving(true);
    try {
      if (count === 0 && existing) {
        await bodyRepository.deleteMeasurement(existing.id);
      } else if (count > 0) {
        await bodyRepository.saveMeasurement({
          id: existing?.id,
          date: day,
          time: time || undefined,
          values: Object.fromEntries(Object.entries(entries).map(([key, e]) => [key, e.base])),
          planId: entry?.planId ?? existing?.planId,
          slot: entry?.planId ? entry.slot : existing?.slot,
        });
        // kleine Rückmeldung zur Veränderung beim ersten erfassten Wert mit Vorwert
        const first = shown.find((m) => entries[m.key] && suggestions.get(m.key));
        const previous = first ? suggestions.get(first.key) : undefined;
        if (first && previous) {
          const delta = entries[first.key].base - previous.value;
          toast(
            t("body.savedDelta", {
              name: first.name,
              delta: formatMetric(first, delta, language, { signed: true }),
              date: format(parseDateKey(previous.date), language === "de" ? "d. MMM" : "MMM d", { locale }),
            }),
          );
        } else {
          toast(t("body.saved"));
        }
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    await bodyRepository.deleteMeasurement(existing.id);
    setConfirmDelete(false);
    toast(t("body.deleted"));
    onDone();
  };

  return (
    <div className="pb-4">
      <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted">{t("body.date")}</span>
          <input
            type="date"
            value={day}
            max={today}
            disabled={Boolean(entry)}
            onChange={(e) => e.target.value && onDayChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-elevated px-3 text-[16px] font-semibold text-fg outline-none focus:border-accent/70"
          />
        </label>
        <label className="w-[136px]">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted">
            {t("body.time")} <span className="font-normal text-subtle">({t("common.optional")})</span>
          </span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-elevated px-3 text-[16px] font-semibold text-fg outline-none focus:border-accent/70"
          />
        </label>
      </div>
      {existing && <p className="mb-1 text-xs font-semibold text-accent-light">{t("body.editingExisting")}</p>}

      <div className="divide-y divide-line">
        {shown.map((metric) => {
          const previous = suggestions.get(metric.key);
          const suggestion = previous ? roundTo(toDisplay(metric, previous.value), metric.decimals) : undefined;
          const hint = previous
            ? t("body.lastValue", {
                value: formatMetric(metric, previous.value, language),
                date: format(parseDateKey(previous.date), language === "de" ? "d. MMM" : "MMM d", { locale }),
              })
            : t("body.firstValue");
          return (
            <MetricInput
              key={metric.key}
              metric={metric}
              value={entries[metric.key]?.display}
              suggestion={suggestion}
              hint={hint}
              check={checks.get(metric.key)}
              onChange={(display) => setValue(metric, display)}
            />
          );
        })}
      </div>

      {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">{t("body.noActiveMetrics")}</p>}

      <div className="sticky -bottom-4 -mx-5 mt-4 border-t border-line bg-card px-5 pb-4 pt-3">
        <Button size="lg" className="w-full" onClick={() => void save()} disabled={saving || invalid || (count === 0 && !existing)}>
          {count === 0 ? (existing ? t("body.saveEmpty") : t("body.nothingToSave")) : t("body.saveCount", { count })}
        </Button>
        {existing && (
          <Button variant="ghost" className="mt-1 w-full text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden /> {t("body.deleteMeasurement")}
          </Button>
        )}
      </div>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("body.deleteMeasurement")}
        description={t("body.deleteConfirm")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}
