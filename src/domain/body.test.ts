import { describe, expect, it } from "vitest";

import { backupReminder } from "./backup-reminder";
import {
  checkValue,
  defaultBodySettings,
  formatMetric,
  fromDisplay,
  kpiMetrics,
  normalizeBodySettings,
  parseDisplayInput,
  resolveMetrics,
  roundTo,
  toDisplay,
} from "./body";
import { latestPoint, metricSeries, periodStartKey, periodStats, pointsInPeriod } from "./body-stats";
import type { BodyMeasurement } from "./types";

const TODAY = new Date("2026-10-05T10:00:00+02:00");

const m = (id: string, date: string, values: Record<string, number>, time?: string): BodyMeasurement => ({
  id,
  profileId: "p1",
  date,
  time,
  values,
  createdAt: `${date}T06:00:00.000Z`,
  updatedAt: `${date}T06:00:00.000Z`,
});

describe("Messwerte – Katalog und Einheiten", () => {
  const settings = defaultBodySettings("p1");

  it("Standardvorlage: die acht Waagen-/Maßwerte aktiv, Zusatzmaße inaktiv", () => {
    const metrics = resolveMetrics(settings, "de", "metric");
    expect(metrics.filter((x) => x.enabled).map((x) => x.key)).toEqual([
      "weight",
      "body_fat",
      "body_water",
      "muscle_kg",
      "bone",
      "scale_kcal",
      "bmi",
      "waist",
    ]);
    expect(metrics.find((x) => x.key === "hip")?.enabled).toBe(false);
  });

  it("kg ↔ lb und cm ↔ in: gespeichert ungerundet in kg/cm, gerundet nur in der Anzeige", () => {
    const imperial = resolveMetrics(settings, "en", "imperial");
    const weight = imperial.find((x) => x.key === "weight")!;
    const waist = imperial.find((x) => x.key === "waist")!;
    expect(weight.unit).toBe("lb");
    expect(waist.unit).toBe("in");
    const stored = fromDisplay(weight, 165.4);
    expect(stored).toBeCloseTo(75.0243, 3);
    expect(roundTo(toDisplay(weight, stored), 1)).toBe(165.4);
    expect(formatMetric(weight, 75.3, "en")).toBe("166.0 lb");
    expect(formatMetric(waist, 88, "en")).toBe("34.65 in");
    const metric = resolveMetrics(settings, "de", "metric");
    expect(formatMetric(metric.find((x) => x.key === "weight")!, 75.3, "de")).toBe("75,3 kg");
    expect(formatMetric(metric.find((x) => x.key === "body_fat")!, 22.14, "de")).toBe("22,1 %");
    expect(formatMetric(metric.find((x) => x.key === "scale_kcal")!, 1650, "de")).toBe("1.650 kcal");
  });

  it("Prozent, kcal, BMI und eigene Werte werden nie umgerechnet", () => {
    const withCustom = normalizeBodySettings({
      ...settings,
      custom: [{ key: "custom-a", name: "Puls morgens", unit: "bpm", step: 1, createdAt: "2026-10-01" }],
    });
    const imperial = resolveMetrics(withCustom, "de", "imperial");
    for (const key of ["body_fat", "scale_kcal", "bmi", "custom-a"]) {
      expect(imperial.find((x) => x.key === key)?.factor).toBe(1);
    }
    const custom = imperial.find((x) => x.key === "custom-a")!;
    expect(custom.unit).toBe("bpm");
    expect(custom.decimals).toBe(0);
    expect(custom.enabled).toBe(true);
  });

  it("Kacheln: Gewicht, Körperfett, Muskel – Muskel in der aktiven Variante", () => {
    expect(kpiMetrics(resolveMetrics(settings, "de", "metric")).map((x) => x.key)).toEqual(["weight", "body_fat", "muscle_kg"]);
    const pct = { ...settings, metrics: settings.metrics.map((x) => (x.key === "muscle_kg" ? { ...x, enabled: false } : x.key === "muscle_pct" ? { ...x, enabled: true } : x)) };
    expect(kpiMetrics(resolveMetrics(pct, "de", "metric")).map((x) => x.key)).toEqual(["weight", "body_fat", "muscle_pct"]);
  });

  it("Eingabe mit Komma oder Punkt; Plausibilität nur als Hinweis", () => {
    expect(parseDisplayInput("75,3")).toBe(75.3);
    expect(parseDisplayInput(" 75.3 ")).toBe(75.3);
    expect(parseDisplayInput("")).toBeUndefined();
    expect(parseDisplayInput("abc")).toBeUndefined();
    const weight = resolveMetrics(settings, "de", "metric").find((x) => x.key === "weight")!;
    const fat = resolveMetrics(settings, "de", "metric").find((x) => x.key === "body_fat")!;
    expect(checkValue(weight, 75.3)).toBe("ok");
    expect(checkValue(weight, 753)).toBe("unusual");
    expect(checkValue(weight, -1)).toBe("invalid");
    expect(checkValue(fat, 120)).toBe("invalid");
  });

  it("Normalisierung: unbekannte Schlüssel weg, neue Standardwerte inaktiv angehängt", () => {
    const old = { ...settings, metrics: [{ key: "waist", enabled: true }, { key: "gone", enabled: true }, { key: "weight", enabled: true }] };
    const n = normalizeBodySettings(old);
    expect(n.metrics.slice(0, 2)).toEqual([{ key: "waist", enabled: true }, { key: "weight", enabled: true }]);
    expect(n.metrics.find((x) => x.key === "body_fat")?.enabled).toBe(false);
    expect(n.metrics.some((x) => x.key === "gone")).toBe(false);
  });
});

describe("Fortschritt – Zeiträume und Kennzahlen", () => {
  const data = [
    m("a", "2025-09-01", { weight: 80 }),
    m("b", "2025-10-06", { weight: 79 }),
    m("c", "2026-09-06", { weight: 77, body_fat: 23 }),
    m("d", "2026-09-20", { weight: 76.5 }),
    m("e", "2026-10-05", { weight: 75.3 }, "07:10"),
    m("f", "2026-10-05", { body_fat: 22 }, "06:50"),
  ];

  it("30 Tage = heute + 29 Tage davor, 365 Tage = heute + 364 Tage davor", () => {
    expect(periodStartKey("30d", TODAY)).toBe("2026-09-06");
    expect(periodStartKey("365d", TODAY)).toBe("2025-10-06");
    expect(periodStartKey("all", TODAY)).toBeUndefined();
  });

  it("Entwicklung = erster bis neuester Wert im Zeitraum; Ø, Min, Max", () => {
    const series = metricSeries(data, "weight");
    const d30 = periodStats(pointsInPeriod(series, "30d", TODAY));
    expect(d30.count).toBe(3);
    expect(d30.change).toBeCloseTo(-1.7, 5);
    expect(d30.min).toBe(75.3);
    expect(d30.max).toBe(77);
    expect(d30.avg).toBeCloseTo((77 + 76.5 + 75.3) / 3, 5);
    const d365 = periodStats(pointsInPeriod(series, "365d", TODAY));
    expect(d365.first?.date).toBe("2025-10-06");
    expect(d365.change).toBeCloseTo(-3.7, 5);
    const all = periodStats(pointsInPeriod(series, "all", TODAY));
    expect(all.first?.value).toBe(80);
    expect(all.change).toBeCloseTo(-4.7, 5);
  });

  it("weniger als zwei Werte → keine Entwicklung (keine künstliche 0)", () => {
    const fat30 = periodStats(pointsInPeriod(metricSeries([m("x", "2026-10-01", { body_fat: 22 })], "body_fat"), "30d", TODAY));
    expect(fat30.count).toBe(1);
    expect(fat30.change).toBeUndefined();
    expect(periodStats([]).count).toBe(0);
  });

  it("gleicher Tag: nach Uhrzeit sortiert; letzter Wert je Messwert", () => {
    const fat = metricSeries(data, "body_fat");
    expect(fat.map((p) => p.date)).toEqual(["2026-09-06", "2026-10-05"]);
    expect(latestPoint(data, "weight")?.value).toBe(75.3);
    expect(latestPoint(data, "weight", { upToDate: "2026-09-30" })?.value).toBe(76.5);
    expect(latestPoint(data, "weight", { excludeId: "e" })?.value).toBe(76.5);
  });
});

describe("Backup-Hinweis", () => {
  const now = new Date("2026-10-12T09:00:00+02:00");

  it("neues Gerät ohne eigene Daten: kein Hinweis", () => {
    expect(backupReminder({ now })).toEqual({ show: false, recommended: false, daysSince: undefined });
  });

  it("noch kein Backup: Zeile sofort, empfohlen erst 7 Tage nach den ersten Daten", () => {
    expect(backupReminder({ now, firstDataAt: "2026-10-10T08:00:00Z", lastDataAt: "2026-10-11T08:00:00Z" })).toMatchObject({ show: true, recommended: false });
    expect(backupReminder({ now, firstDataAt: "2026-10-04T08:00:00Z", lastDataAt: "2026-10-11T08:00:00Z" }).recommended).toBe(true);
  });

  it("empfohlen nur bei ≥ 7 Tagen UND neuen Daten seitdem", () => {
    const base = { now, firstDataAt: "2026-09-01T08:00:00Z", lastBackupAt: "2026-10-04T18:00:00Z" };
    expect(backupReminder({ ...base, lastDataAt: "2026-10-10T08:00:00Z" })).toEqual({ show: true, recommended: true, daysSince: 8 });
    expect(backupReminder({ ...base, lastDataAt: "2026-10-03T08:00:00Z" }).recommended).toBe(false);
    expect(backupReminder({ ...base, lastBackupAt: "2026-10-07T18:00:00Z", lastDataAt: "2026-10-10T08:00:00Z" })).toMatchObject({ recommended: false, daysSince: 5 });
  });
});
