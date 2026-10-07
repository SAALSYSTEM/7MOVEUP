import { format } from "date-fns";
import { ChevronDown, ChevronRight, ClipboardList, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { LineChart, type ChartPoint } from "@/components/body/line-chart";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { formatMetric, formatNumber, kpiMetrics, roundTo, toDisplay, type MetricView } from "@/domain/body";
import {
  BODY_PERIODS,
  dailySeries,
  histogram,
  metricSeries,
  periodStartKey,
  periodStats,
  pointsInPeriod,
  type BodyPeriod,
  type SeriesPoint,
} from "@/domain/body-stats";
import type { BodyMeasurement } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { useToday } from "@/hooks/use-today";
import { dateLocale, localDateKey, parseDateKey } from "@/lib/dates";

const DAY_MS = 864e5;

/** Datum (+ Uhrzeit) → Tage seit Epoche, für die Zeitachse */
function dayNumber(date: string, time?: string) {
  const [h, m] = (time ?? "12:00").split(":").map(Number);
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS + (h * 60 + m) / 1440;
}

/** Fortschritt – bewusst einfach: drei Kacheln, ein Analysebereich, ein Linienchart. */
export function ProgressPage() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const today = useToday();
  const locale = dateLocale(language);
  const body = useBodyData();
  const [params, setParams] = useSearchParams();
  const [captureOpen, setCaptureOpen] = useState(false);

  const kpis = kpiMetrics(body.metrics);
  // auswählbar: aktive Messwerte und alle mit vorhandenen Werten
  const selectable = useMemo(
    () => body.metrics.filter((m) => m.enabled || body.measurements.some((x) => typeof x.values[m.key] === "number")),
    [body.metrics, body.measurements],
  );
  const metricKey = params.get("metric");
  const metric = selectable.find((m) => m.key === metricKey) ?? kpis[0] ?? selectable[0];
  const period: BodyPeriod = (BODY_PERIODS as readonly string[]).includes(params.get("period") ?? "")
    ? (params.get("period") as BodyPeriod)
    : "30d";

  const setParam = (key: "metric" | "period", value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const shortDate = (key: string) => format(parseDateKey(key), language === "de" ? "d. MMM" : "MMM d", { locale });
  // pro Tag ein Punkt: bei mehreren Messungen mit Anzahl statt Uhrzeit
  const longDate = (point: SeriesPoint) => {
    const day = format(parseDateKey(point.date), language === "de" ? "EEE, d. MMM yyyy" : "EEE, MMM d, yyyy", { locale });
    if (point.count && point.count > 1) return `${day} · ${t("progress.measurements", { count: point.count })}`;
    return `${day}${point.time ? ` · ${point.time}` : ""}`;
  };

  if (!body.loaded) return <Page />;

  const hasAny = body.measurements.length > 0;

  return (
    <Page>
      <AppHeader left={<PageTitle>{t("progress.title")}</PageTitle>} />

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => navigate("/progress/metrics")}>
          <SlidersHorizontal size={16} className="shrink-0" aria-hidden /> {t("metrics.title")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate("/progress/plan")}>
          <ClipboardList size={16} className="shrink-0" aria-hidden /> {t("progress.tabPlan")}
        </Button>
        <Button size="sm" onClick={() => navigate("/progress/capture")}>
          <Plus size={17} className="shrink-0" aria-hidden /> {t("progress.capture")}
        </Button>
      </div>
      {hasAny && (
        <Link
          to="/progress/values"
          className="mb-4 inline-flex h-10 items-center gap-1 rounded-xl px-1 text-sm font-bold text-accent-light hover:bg-white/5"
        >
          {t("progress.myValues")} <ChevronRight size={16} aria-hidden />
        </Link>
      )}

      {/* Drei Kacheln: aktueller Wert, Einheit, Datum der letzten Messung */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <KpiTile
            key={kpi.key}
            metric={kpi}
            latest={dailySeries(body.measurements, kpi.key).at(-1)}
            selected={metric?.key === kpi.key}
            onSelect={() => setParam("metric", kpi.key)}
            onCapture={() => setCaptureOpen(true)}
            dateLabel={shortDate}
          />
        ))}
      </div>

      {!hasAny || !metric ? (
        <Card className="p-5">
          <h2 className="text-lg font-black tracking-tight">{t("progress.howTitle")}</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            {(["progress.how1", "progress.how2", "progress.how3"] as const).map((key, i) => (
              <li key={key} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-black text-accent-light">
                  {i + 1}
                </span>
                <span className="pt-0.5">{t(key)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("progress.howEnd")}</p>
          <Button className="mt-4 w-full" onClick={() => setCaptureOpen(true)}>
            <Plus size={18} aria-hidden /> {t("progress.firstCapture")}
          </Button>
        </Card>
      ) : (
        <>
          <Analysis
            metric={metric}
            selectable={selectable}
            onMetric={(key) => setParam("metric", key)}
            period={period}
            onPeriod={(p) => setParam("period", p)}
            series={dailySeries(body.measurements, metric.key)}
            today={today}
            shortDate={shortDate}
            longDate={longDate}
          />
          {(metric.key === "bp_sys" || metric.key === "bp_dia") && (
            <Distribution metric={metric} measurements={body.measurements} period={period} today={today} />
          )}
        </>
      )}

      <MeasurementSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </Page>
  );
}

function KpiTile({
  metric,
  latest,
  selected,
  onSelect,
  onCapture,
  dateLabel,
}: {
  metric: MetricView;
  latest: SeriesPoint | undefined;
  selected: boolean;
  onSelect: () => void;
  /** Kachel ohne Wert: Antippen öffnet direkt die Erfassung */
  onCapture: () => void;
  dateLabel: (key: string) => string;
}) {
  const { t, language } = useApp();
  const value = latest ? formatNumber(roundTo(toDisplay(metric, latest.value), metric.decimals), metric.decimals, language) : "–";
  return (
    <button
      type="button"
      onClick={latest ? onSelect : onCapture}
      aria-pressed={latest ? selected : undefined}
      aria-label={latest ? undefined : `${metric.name}: ${t("progress.capture")}`}
      className={`min-w-0 rounded-[18px] border p-3 text-left transition-colors ${selected ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-card"}`}
    >
      <span className="block truncate text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{metric.name}</span>
      <span className="mt-1.5 flex items-baseline gap-1">
        <span className="truncate text-[22px] font-black leading-none tracking-tight">{value}</span>
        {latest && metric.unit && <span className="shrink-0 text-xs font-bold text-muted">{metric.unit}</span>}
      </span>
      <span className="mt-1.5 block truncate text-[11px] text-subtle">{latest ? (
          dateLabel(latest.date)
        ) : (
          <span className="inline-flex items-center gap-0.5 font-bold text-accent-light">
            <Plus size={11} strokeWidth={3} aria-hidden /> {t("progress.capture")}
          </span>
        )}</span>
    </button>
  );
}

function Analysis({
  metric,
  selectable,
  onMetric,
  period,
  onPeriod,
  series,
  today,
  shortDate,
  longDate,
}: {
  metric: MetricView;
  selectable: MetricView[];
  onMetric: (key: string) => void;
  period: BodyPeriod;
  onPeriod: (period: BodyPeriod) => void;
  series: SeriesPoint[];
  today: Date;
  shortDate: (key: string) => string;
  longDate: (point: SeriesPoint) => string;
}) {
  const { t, language } = useApp();
  const points = pointsInPeriod(series, period, today);
  const stats = periodStats(points);
  const fmt = (base: number, signed = false) => formatMetric(metric, base, language, { signed });

  const startKey = periodStartKey(period, today) ?? points[0]?.date ?? localDateKey(today);
  const endKey = period === "all" ? (points.at(-1)?.date ?? localDateKey(today)) : localDateKey(today);
  const chartPoints: ChartPoint[] = points.map((p) => ({
    t: dayNumber(p.date, p.count && p.count > 1 ? undefined : p.time),
    value: toDisplay(metric, p.value),
    dateLabel: longDate(p),
    valueLabel: p.count && p.count > 1 ? t("progress.dayAvg", { value: fmt(p.value) }) : fmt(p.value),
  }));
  const tickDecimals = metric.decimals > 0 && Math.abs((stats.max ?? 0) - (stats.min ?? 0)) < 3 ? 1 : 0;

  return (
    <Card className="p-4">
      <label className="relative mb-3 flex items-center gap-1">
        <span className="sr-only">{t("progress.metric")}</span>
        <select
          value={metric.key}
          onChange={(e) => onMetric(e.target.value)}
          className="h-11 max-w-full appearance-none truncate rounded-xl bg-transparent pr-7 text-xl font-black tracking-tight text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent-light/60"
        >
          {selectable.map((m) => (
            <option key={m.key} value={m.key}>
              {m.name}
            </option>
          ))}
        </select>
        <ChevronDown size={20} className="pointer-events-none -ml-7 text-accent" aria-hidden />
      </label>

      <Segmented<BodyPeriod>
        ariaLabel={t("progress.period")}
        layoutId="progress-period"
        role="radio"
        value={period}
        onChange={onPeriod}
        options={[
          { value: "30d", label: t("progress.period30") },
          { value: "365d", label: t("progress.period365") },
          { value: "all", label: t("progress.periodAll") },
        ]}
      />

      <div className="mt-4">
        {points.length === 0 ? (
          <p className="flex h-[184px] items-center justify-center rounded-xl border border-dashed border-line text-center text-sm text-muted">
            {t("progress.noValuesInPeriod")}
          </p>
        ) : (
          <LineChart
            points={chartPoints}
            domain={[dayNumber(startKey), dayNumber(endKey)]}
            formatTick={(v) => formatNumber(v, tickDecimals, language)}
            startLabel={shortDate(startKey)}
            endLabel={shortDate(endKey)}
            ariaLabel={t("progress.chartLabel", { name: metric.name, count: points.length })}
          />
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm font-bold text-muted">{t("progress.change")}</span>
        {stats.change !== undefined && stats.first ? (
          <span className="text-right">
            <span className="block text-xl font-black tracking-tight">{fmt(stats.change, true)}</span>
            <span className="block text-[11px] text-subtle">{t("progress.since", { date: shortDate(stats.first.date) })}</span>
          </span>
        ) : (
          <span className="text-sm font-semibold text-subtle">{t("progress.tooFew")}</span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: t("progress.avg"), value: stats.avg },
          { label: t("progress.min"), value: stats.min },
          { label: t("progress.max"), value: stats.max },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-elevated px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{item.label}</dt>
            <dd className="mt-1 truncate text-sm font-black">{item.value !== undefined ? fmt(item.value) : "–"}</dd>
          </div>
        ))}
      </dl>

      {/* Tabellenansicht für Screenreader */}
      <table className="sr-only">
        <caption>{t("progress.tableCaption", { name: metric.name })}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.measurementId}>
              <th scope="row">{longDate(p)}</th>
              <td>{fmt(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Verteilung aller Einzelmessungen im Zeitraum (nur Blutdruck) – ruhige Balken in 10er-Klassen, keine Bewertung. */
function Distribution({
  metric,
  measurements,
  period,
  today,
}: {
  metric: MetricView;
  measurements: BodyMeasurement[];
  period: BodyPeriod;
  today: Date;
}) {
  const { t, language } = useApp();
  const raw = pointsInPeriod(metricSeries(measurements, metric.key), period, today);
  const bins = histogram(
    raw.map((p) => p.value),
    10,
  );
  const max = Math.max(1, ...bins.map((b) => b.count));
  const periodLabel = t(period === "30d" ? "progress.period30" : period === "365d" ? "progress.period365" : "progress.periodAll");
  const mean = raw.length > 0 ? raw.reduce((sum, p) => sum + p.value, 0) / raw.length : undefined;

  return (
    <Card className="mt-3 p-4">
      <h2 className="text-lg font-black tracking-tight">{t("progress.distribution")}</h2>
      <p className="mt-0.5 text-xs text-subtle">
        {t("progress.distributionInfo", { name: metric.name, period: periodLabel, count: raw.length })}
      </p>
      {raw.length < 5 ? (
        <p className="mt-3 text-sm text-muted">{t("progress.distributionFew")}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {bins.map((bin) => (
              <li key={bin.from} className="flex items-center gap-3 text-sm">
                <span className="tabular w-[76px] shrink-0 text-xs font-semibold text-muted">
                  {bin.from}–{bin.to}
                </span>
                <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-elevated">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(bin.count / max) * 100}%` }} />
                </span>
                <span className="tabular w-6 shrink-0 text-right text-xs font-black">{bin.count}</span>
              </li>
            ))}
          </ul>
          {mean !== undefined && (
            <p className="mt-3 text-xs text-subtle">
              {t("progress.distributionAvg", { value: formatMetric(metric, mean, language) })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
