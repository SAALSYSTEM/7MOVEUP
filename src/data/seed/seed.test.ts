import { describe, expect, it } from "vitest";

import { BUILT_IN_EXERCISES, SEED_EXERCISE_COUNT, WORKOUT_TEMPLATES } from "./index";

describe("Seed-Daten", () => {
  it("lädt alle 40 gelieferten Übungen plus Ergometer", () => {
    expect(SEED_EXERCISE_COUNT).toBe(40);
    expect(BUILT_IN_EXERCISES).toHaveLength(41);
    expect(new Set(BUILT_IN_EXERCISES.map((e) => e.id)).size).toBe(41);
  });

  it("mappt alle Regionen/Equipments auf bekannte Schlüssel", () => {
    for (const exercise of BUILT_IN_EXERCISES) {
      expect(exercise.bodyRegions.length).toBeGreaterThan(0);
      expect(exercise.equipment.length).toBeGreaterThan(0);
    }
    const arms = BUILT_IN_EXERCISES.filter((e) => e.bodyRegions.includes("arms"));
    expect(arms.length).toBeGreaterThan(0);
  });

  it("behält die gelieferten Video-Links unverändert", () => {
    const bench = BUILT_IN_EXERCISES.find((e) => e.id === "db-flat-bench-press");
    expect(bench?.videoUrls).toEqual(["https://youtube.com/shorts/_G5xkrVfZ88?si=XN6cYyANf6uRiDe3"]);
  });

  it("Vorlagen referenzieren nur existierende Übungen", () => {
    const ids = new Set(BUILT_IN_EXERCISES.map((e) => e.id));
    expect(WORKOUT_TEMPLATES).toHaveLength(3);
    for (const template of WORKOUT_TEMPLATES) {
      for (const day of template.days) for (const item of day.items) expect(ids.has(item.exerciseId)).toBe(true);
    }
  });

  it("6-Tage-Vorlage: Ruhetag Sonntag wird kein Plan, Cardio-Tage nutzen Ergometer", () => {
    const six = WORKOUT_TEMPLATES.find((t) => t.id === "template-6day-fitness-strength")!;
    expect(six.days).toHaveLength(6);
    expect(six.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(six.days[0].items[0].exerciseId).toBe("ergometer");
    expect(six.days[4].items[0].durationSec).toBe(28 * 60);
  });
});
