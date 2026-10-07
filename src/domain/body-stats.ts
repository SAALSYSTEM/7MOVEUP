/**
 * Auswertung der Körperwerte für Fortschritt – bewusst einfach:
 * rollierende Zeiträume (30 Tage, 365 Tage, Gesamt), Entwicklung, Ø, Min, Max.
 * Alles in Basiseinheit; umgerechnet wird erst in der Anzeige (die Umrechnung ist linear).
 */
import { subDays } from "date-fns";

import type { BodyMeasurement } from "@/domain/types";
import { localDateKey } from "@/lib/dates";

export type BodyPeriod = "30d" | "365d" | "all";
export const BODY_PERIODS: readonly BodyPeriod[] = ["30d", "365d", "all"];

export type SeriesPoint = {
  date: string;
  time?: string;
  value: number;
  measurementId: string;
  createdAt: string;
  /** Tagesdurchschnitt: Anzahl der Messungen dieses Tages (bei Einzelwerten fehlt das Feld) */
  count?: number;
};

function compareMeasurements(a: Pick<BodyMeasurement, "date" | "time" | "createdAt">, b: Pick<BodyMeasurement, "date" | "time" | "createdAt">) {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.createdAt.localeCompare(b.createdAt);
}

export function sortMeasurements(list: BodyMeasurement[]): BodyMeasurement[] {
  return [...list].sort(compareMeasurements);
}

/** Alle Werte eines Messwerts, älteste zuerst */
export function metricSeries(measurements: BodyMeasurement[], key: string): SeriesPoint[] {
  return sortMeasurements(measurements).flatMap((m) => {
    const value = m.values[key];
    return typeof value === "number" && Number.isFinite(value)
      ? [{ date: m.date, time: m.time, value, measurementId: m.id, createdAt: m.createdAt }]
      : [];
  });
}

/**
 * Ein Wert pro Kalendertag: der Durchschnitt aller Messungen dieses Tages (bei nur einer Messung diese selbst).
 * Grundlage für Linienchart, Kacheln, Entwicklung, Ø, Min und Max; die Einzelmessungen bleiben unverändert gespeichert.
 */
export function dailySeries(measurements: BodyMeasurement[], key: string): SeriesPoint[] {
  const days = new Map<string, SeriesPoint[]>();
  for (const point of metricSeries(measurements, key)) days.set(point.date, [...(days.get(point.date) ?? []), point]);
  return [...days.entries()].map(([date, points]) => {
    const last = points[points.length - 1];
    if (points.length === 1) return { ...last, count: 1 };
    return {
      date,
      value: points.reduce((sum, p) => sum + p.value, 0) / points.length,
      measurementId: last.measurementId,
      createdAt: last.createdAt,
      count: points.length,
    };
  });
}

export type HistogramBin = { from: number; to: number; count: number };

/** Verteilung aller Einzelwerte in festen Klassen (z. B. 10 mmHg); leere Klassen dazwischen bleiben erhalten. */
export function histogram(values: number[], width: number): HistogramBin[] {
  if (values.length === 0) return [];
  const bins = values.map((v) => Math.floor(v / width));
  const lo = Math.min(...bins);
  const hi = Math.max(...bins);
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({
    from: (lo + i) * width,
    to: (lo + i + 1) * width - 1,
    count: bins.filter((b) => b === lo + i).length,
  }));
}

/** Erster Tag des Zeitraums (inklusive): 30 Tage = heute + 29 Tage davor; Gesamt = ohne Grenze */
export function periodStartKey(period: BodyPeriod, today: Date): string | undefined {
  if (period === "30d") return localDateKey(subDays(today, 29));
  if (period === "365d") return localDateKey(subDays(today, 364));
  return undefined;
}

export function pointsInPeriod(series: SeriesPoint[], period: BodyPeriod, today: Date): SeriesPoint[] {
  const start = periodStartKey(period, today);
  const end = localDateKey(today);
  return series.filter((p) => (!start || p.date >= start) && p.date <= end);
}

export type PeriodStats = {
  count: number;
  first?: SeriesPoint;
  last?: SeriesPoint;
  /** letzter minus erster Wert – nur bei mindestens zwei Werten */
  change?: number;
  avg?: number;
  min?: number;
  max?: number;
};

export function periodStats(points: SeriesPoint[]): PeriodStats {
  if (points.length === 0) return { count: 0 };
  const values = points.map((p) => p.value);
  const first = points[0];
  const last = points[points.length - 1];
  return {
    count: points.length,
    first,
    last,
    change: points.length >= 2 ? last.value - first.value : undefined,
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** Letzter bekannter Wert bis einschließlich `upToDate`, optional ohne eine bestimmte Messung */
export function latestPoint(
  measurements: BodyMeasurement[],
  key: string,
  { upToDate, excludeId }: { upToDate?: string; excludeId?: string } = {},
): SeriesPoint | undefined {
  const series = metricSeries(
    measurements.filter((m) => m.id !== excludeId && (!upToDate || m.date <= upToDate)),
    key,
  );
  return series.at(-1);
}

/** Wird ein Messwert schon verwendet? (dann bleibt seine Einheit fest) */
export function metricHasValues(measurements: BodyMeasurement[], key: string) {
  return measurements.some((m) => typeof m.values[key] === "number");
}
