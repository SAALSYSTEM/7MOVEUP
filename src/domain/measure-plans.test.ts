import { describe, expect, it } from "vitest";

import { defaultBodySettings, normalizeBodySettings } from "@/domain/body";
import { entryTitle, measureEntriesForDate, planWeekdays } from "@/domain/measure-plans";
import type { BodyMeasurement, MeasurePlan } from "@/domain/types";

const SUNDAY = new Date(2026, 9, 11); // So 11.10.2026
const WEDNESDAY = new Date(2026, 9, 14);

const bp: MeasurePlan = { id: "bp", name: "Blutdruck", metricKeys: ["bp_sys", "bp_dia"], weekdays: [7], perDay: 3 };
const weigh: MeasurePlan = { id: "w", name: "Wiegen", metricKeys: ["weight"], weekdays: [3, 7], perDay: 1 };

function measurement(over: Partial<BodyMeasurement>): BodyMeasurement {
  return { id: "m", profileId: "p", date: "2026-10-11", values: { weight: 80 }, createdAt: "", updatedAt: "", ...over };
}

describe("Messpläne", () => {
  it("erzeugt pro Plan und Zeitfenster einen Eintrag", () => {
    const entries = measureEntriesForDate([bp, weigh], [], SUNDAY);
    expect(entries.map((e) => entryTitle(e, "Körperwerte"))).toEqual(["Blutdruck 1/3", "Blutdruck 2/3", "Blutdruck 3/3", "Wiegen"]);
    expect(entries.every((e) => !e.measurement)).toBe(true);
  });

  it("nur Pläne des Wochentags", () => {
    expect(measureEntriesForDate([bp, weigh], [], WEDNESDAY).map((e) => e.planId)).toEqual(["w"]);
    expect(planWeekdays([bp, weigh])).toEqual([3, 7]);
  });

  it("ordnet Messungen Plan und Zeitfenster zu", () => {
    const entries = measureEntriesForDate(
      [bp],
      [measurement({ id: "a", planId: "bp", slot: 1 }), measurement({ id: "b", planId: "bp", slot: 0 })],
      SUNDAY,
    );
    expect(entries.map((e) => e.measurement?.id)).toEqual(["b", "a", undefined]);
  });

  it("freie Messung füllt den ersten offenen Eintrag", () => {
    const entries = measureEntriesForDate([weigh], [measurement({ id: "free" })], SUNDAY);
    expect(entries).toHaveLength(1);
    expect(entries[0].measurement?.id).toBe("free");
  });

  it("freie Messung ohne passenden Plan bleibt als erledigter Eintrag sichtbar", () => {
    const entries = measureEntriesForDate([], [measurement({ id: "free" })], SUNDAY);
    expect(entries).toHaveLength(1);
    expect(entries[0].measurement?.id).toBe("free");
    expect(entryTitle(entries[0], "Körperwerte")).toBe("Körperwerte");
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
