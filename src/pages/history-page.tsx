import { format, getDaysInMonth } from "date-fns";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bodyRepository } from "@/data";
import { formatMetric, resolveMetrics, type MetricView } from "@/domain/body";
import type { BodyMeasurement } from "@/domain/types";
import { useData } from "@/hooks/use-data";
import { dateLocale, parseDateKey } from "@/lib/dates";

/** So viele Messungen pro Ladeschritt (der letzte Tag wird vollständig mitgeliefert) */
const PAGE_SIZE = 10;

const pad = (n: number | string) => String(n).padStart(2, "0");

/** Filter Jahr/Monat/Tag → Tage von/bis (inklusive) */
function dateRange(year: string, month: string, day: string): { from?: string; to?: string } {
  if (!year) return {};
  if (!month) return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (!day) return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-31` };
  const key = `${year}-${pad(month)}-${pad(day)}`;
  return { from: key, to: key };
}

/** Eine Messung als Text; Blutdruck zusammengefasst („118 / 72 mmHg · Puls 64“). */
function valuesText(m: BodyMeasurement, metrics: MetricView[], language: "de" | "en") {
  const parts: string[] = [];
  const sys = m.values.bp_sys;
  const dia = m.values.bp_dia;
  if (typeof sys === "number" && typeof dia === "number") {
    parts.push(`${Math.round(sys)} / ${Math.round(dia)} mmHg`);
  }
  for (const metric of metrics) {
    const value = m.values[metric.key];
    if (typeof value !== "number") continue;
    if (parts.length > 0 && typeof sys === "number" && typeof dia === "number" && (metric.key === "bp_sys" || metric.key === "bp_dia")) continue;
    parts.push(`${metric.name} ${formatMetric(metric, value, language)}`);
  }
  return parts.join(" · ");
}

/** Meine erfassten Werte: alle gespeicherten Messungen, neueste zuerst, in Schritten geladen (nie die ganze Historie). */
export function HistoryPage() {
  const { t, language, settings } = useApp();
  const locale = dateLocale(language);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);

  const { from, to } = dateRange(year, month, day);
  const page = useData(() => bodyRepository.getMeasurementsPage({ from, to, limit }), [from, to, limit]);
  const years = useData(() => bodyRepository.getMeasurementYearRange());
  const bodySettings = useData(() => bodyRepository.getSettings());

  const metrics = bodySettings.data ? resolveMetrics(bodySettings.data, language, settings.unitSystem ?? "metric") : [];
  const plans = bodySettings.data?.plans ?? [];
  const yearOptions = years.data ? Array.from({ length: years.data.last - years.data.first + 1 }, (_, i) => years.data!.last - i) : [];
  const dayCount = year && month ? getDaysInMonth(new Date(Number(year), Number(month) - 1, 1)) : 31;

  const reset = (next: { year?: string; month?: string; day?: string }) => {
    setYear(next.year ?? "");
    setMonth(next.month ?? "");
    setDay(next.day ?? "");
    setLimit(PAGE_SIZE);
  };
  const selectClass =
    "h-11 w-full min-w-0 rounded-xl border border-line bg-elevated px-3 text-[16px] font-semibold text-fg outline-none focus:border-accent/70 disabled:opacity-40";

  return (
    <Page>
      <SubHeader title={t("history.title")} fallback="/progress" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted">{t("history.year")}</span>
          <select className={selectClass} value={year} onChange={(e) => reset({ year: e.target.value })}>
            <option value="">{t("history.all")}</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted">{t("history.month")}</span>
          <select className={selectClass} value={month} disabled={!year} onChange={(e) => reset({ year, month: e.target.value })}>
            <option value="">{t("history.all")}</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {format(new Date(2000, i, 1), "LLLL", { locale })}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold text-muted">{t("history.day")}</span>
          <select className={selectClass} value={day} disabled={!month} onChange={(e) => reset({ year, month, day: e.target.value })}>
            <option value="">{t("history.all")}</option>
            {Array.from({ length: dayCount }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      {page.data && page.data.items.length === 0 && <Card className="p-4 text-sm text-muted">{t("history.empty")}</Card>}

      {page.data && page.data.items.length > 0 && (
        <Card className="divide-y divide-line">
          {page.data.items.map((m) => {
            const owner = m.planId ? plans.find((p) => p.id === m.planId) : undefined;
            const when = `${format(parseDateKey(m.date), language === "de" ? "d. MMM yyyy" : "MMM d, yyyy", { locale })}${m.time ? ` · ${m.time}` : ""}`;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setEditing(m)}
                className="block w-full px-4 py-3 text-left"
                aria-label={`${t("common.edit")}: ${owner?.name.trim() || t("calendar.bodyLogged")} · ${when}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="tabular text-xs font-semibold text-subtle">{when}</span>
                  <span className="min-w-0 truncate text-xs font-bold text-accent-light">{owner?.name.trim() || t("calendar.bodyLogged")}</span>
                </span>
                <span className="mt-1 block text-sm font-bold leading-snug">{valuesText(m, metrics, language)}</span>
                {m.note && <span className="mt-0.5 block truncate text-xs italic text-subtle">{m.note}</span>}
              </button>
            );
          })}
        </Card>
      )}

      {page.data?.hasMore && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          {t("history.more")}
        </Button>
      )}

      {editing && <MeasurementSheet open measurement={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
