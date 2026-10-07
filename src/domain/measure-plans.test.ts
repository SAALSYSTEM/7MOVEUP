import { describe, expect, it } from "vitest";

import { defaultBodySettings, normalizeBodySettings } from "@/domain/body";
import { dailySeries, histogram } from "@/domain/body-stats";
import { measureCardsForDate, plannedPerDay, planWeekdays } from "@/domain/measure-plans";
import type { BodyMeasurement, MeasurePlan } from "@/domain/types";

const SUNDAY = new Date(2026, 9, 11); // So 11.10.2026
const WEDNESDAY = new Date(2026, 9, 14);

const bp: MeasurePlan = { id: "bp", name: "Blutdruck", metricKeys: ["bp_sys", "bp_dia"], weekdays: [7], perDay: 3 };
const weigh: MeasurePlan = { id: "w", name: "Wiegen", metricKeys: ["weight"], weekdays: [3, 7], perDay: 1 };

function measurement(over: Partial<BodyMeasurement>): BodyMeasurement {
  return { id: "m", profileId: "p", date: "2026-10-11", values: { weight: 80 }, createdAt: "", updatedAt: "", ...over };
}

describe("Messpläne", () => {
  it("eine Karte pro Plan des Tages – nicht pro Messung", () => {
    const { cards, free } = measureCardsForDate([bp, weigh], [], SUNDAY);
    expect(cards.map((c) => c.plan.id)).toEqual(["bp", "w"]);
    expect(cards.every((c) => c.measurements.length === 0)).toBe(true);
    expect(free).toEqual([]);
    expect(plannedPerDay(bp)).toBe(3);
  });

  it("nur Pläne des Wochentags", () => {
    expect(measureCardsForDate([bp, weigh], [], WEDNESDAY).cards.map((c) => c.plan.id)).toEqual(["w"]);
    expect(planWeekdays([bp, weigh])).toEqual([3, 7]);
  });

  it("zählt Messungen aus dem Plan – auch mehr als geplant", () => {
    const ms = [1, 2, 3, 4].map((i) => measurement({ id: `a${i}`, planId: "bp" }));
    const { cards } = measureCardsForDate([bp], ms, SUNDAY);
    expect(cards[0].measurements).toHaveLength(4);
  });

  it("freie Messungen haken niemals einen Plan ab", () => {
    const { cards, free } = measureCardsForDate([weigh], [measurement({ id: "free" })], SUNDAY);
    expect(cards[0].measurements).toHaveLength(0);
    expect(free.map((m) => m.id)).toEqual(["free"]);
  });

  it("Messung aus einem Plan, der an dem Tag nicht geplant ist, bleibt sichtbar", () => {
    const { cards, free } = measureCardsForDate([bp], [measurement({ id: "x", planId: "bp", date: "2026-10-14" })], WEDNESDAY);
    expect(cards).toEqual([]);
    expect(free.map((m) => m.id)).toEqual(["x"]);
  });

  it("leitet aus alten Messtagen einen Plan ab", () => {
    const settings = normalizeBodySettings({ ...defaultBodySettings("p"), plans: undefined, measureWeekdays: [1, 4] });
    expect(settings.plans).toEqual([{ id: "legacy", name: "", weekdays: [1, 4], perDay: 1 }]);
    expect(normalizeBodySettings({ ...defaultBodySettings("p"), plans: undefined }).plans).toEqual([]);
  });

  it("liefert Blutdruck und Puls im Katalog (inaktiv)", () => {
    const keys = defaultBodySettings("p").metrics.filter((m) => ["bp_sys", "bp_dia", "pulse"].includes(m.key));
    expect(keys).toEqual([
      { key: "bp_sys", enabled: false },
      { key: "bp_dia", enabled: false },
      { key: "pulse", enabled: false },
    ]);
  });
});

describe("Tageswerte und Verteilung", () => {
  const sys = (id: string, date: string, time: string, value: number) =>
    measurement({ id, date, time, values: { bp_sys: value }, createdAt: `${date}T${time}` });

  it("ein Punkt pro Tag: Durchschnitt aller Messungen, einzelne bleiben unverändert", () => {
    const series = dailySeries(
      [sys("a", "2026-10-07", "08:00", 121), sys("b", "2026-10-07", "14:00", 117), sys("c", "2026-10-07", "20:00", 118), sys("d", "2026-10-08", "08:00", 130)],
      "bp_sys",
    );
    expect(series.map((p) => [p.date, p.count])).toEqual([
      ["2026-10-07", 3],
      ["2026-10-08", 1],
    ]);
    expect(series[0].value).toBeCloseTo(118.667, 3);
    expect(series[1].value).toBe(130);
  });

  it("Histogramm in 10er-Klassen über Einzelwerte, leere Klassen dazwischen", () => {
    expect(histogram([104, 112, 118, 121, 139], 10)).toEqual([
      { from: 100, to: 109, count: 1 },
      { from: 110, to: 119, count: 2 },
      { from: 120, to: 129, count: 1 },
      { from: 130, to: 139, count: 1 },
    ]);
    expect(histogram([100, 130], 10).map((b) => b.count)).toEqual([1, 0, 0, 1]);
    expect(histogram([], 10)).toEqual([]);
  });
});
