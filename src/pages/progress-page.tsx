import { format } from "date-fns";
import { Activity, ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { LineChart, type ChartPoint } from "@/components/body/line-chart";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { EmptyState, Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { formatMetric, formatNumber, kpiMetrics, roundTo, toDisplay, type MetricView } from "@/domain/body";
import {
  BODY_PERIODS,
  latestPoint,
  metricSeries,
  periodStartKey,
  periodStats,
  pointsInPeriod,
  type BodyPeriod,
  type SeriesPoint,
} from "@/domain/body-stats";
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
  const longDate = (point: SeriesPoint) =>
    `${format(parseDateKey(point.date), language === "de" ? "EEE, d. MMM yyyy" : "EEE, MMM d, yyyy", { locale })}${point.time ? ` · ${point.time}` : ""}`;

  if (!body.loaded) return <Page />;

  const hasAny = body.measurements.length > 0;

  return (
    <Page>
      <AppHeader left={<PageTitle>{t("progress.title")}</PageTitle>} />

      <div className="mb-5 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => navigate("/progress/metrics")}>
          <SlidersHorizontal size={17} aria-hidden /> {t("metrics.title")}
        </Button>
        <Button onClick={() => setCaptureOpen(true)}>
          <Plus size={18} aria-hidden /> {t("progress.capture")}
        </Button>
      </div>

      {/* Drei Kacheln: aktueller Wert, Einheit, Datum der letzten Messung */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {kpis.map((kpi) => (
          <KpiTile
            key={kpi.key}
            metric={kpi}
            latest={latestPoint(body.measurements, kpi.key)}
            selected={metric?.key === kpi.key}
            onSelect={() => setParam("metric", kpi.key)}
            dateLabel={shortDate}
          />
        ))}
      </div>

      {!hasAny || !metric ? (
        <EmptyState
          icon={<Activity size={28} aria-hidden />}
          title={t("progress.emptyTitle")}
          action={
            <Button onClick={() => setCaptureOpen(true)}>
              <Plus size={18} aria-hidden /> {t("progress.firstCapture")}
            </Button>
          }
        >
          {t("progress.emptyText")}
        </EmptyState>
      ) : (
        <Analysis
          metric={metric}
          selectable={selectable}
          onMetric={(key) => setParam("metric", key)}
          period={period}
          onPeriod={(p) => setParam("period", p)}
          series={metricSeries(body.measurements, metric.key)}
          today={today}
          shortDate={shortDate}
          longDate={longDate}
        />
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
  dateLabel,
}: {
  metric: MetricView;
  latest: SeriesPoint | undefined;
  selected: boolean;
  onSelect: () => void;
  dateLabel: (key: string) => string;
}) {
  const { t, language } = useApp();
  const value = latest ? formatNumber(roundTo(toDisplay(metric, latest.value), metric.decimals), metric.decimals, language) : "–";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-w-0 rounded-[18px] border p-3 text-left transition-colors ${selected ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-card"}`}
    >
      <span className="block truncate text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">{metric.name}</span>
      <span className="mt-1.5 flex items-baseline gap-1">
        <span className="truncate text-[22px] font-black leading-none tracking-tight">{value}</span>
        {latest && metric.unit && <span className="shrink-0 text-xs font-bold text-muted">{metric.unit}</span>}
      </span>
      <span className="mt-1.5 block truncate text-[11px] text-subtle">{latest ? dateLabel(latest.date) : t("progress.noValue")}</span>
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
    t: dayNumber(p.date, p.time),
    value: toDisplay(metric, p.value),
    dateLabel: longDate(p),
    valueLabel: fmt(p.value),
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
