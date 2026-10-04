import { describe, expect, it } from "vitest";

import { countImprovements, isImprovement, isProgressionReady, progressionStepKg } from "./progression";
import type { PerformanceSnapshot, SetLog, WorkoutSession } from "./types";

const set = (weight: number | undefined, reps: number): SetLog => ({ weightPerDumbbellKg: weight, reps, done: true });

const snapshot = (sets: SetLog[], repMax = 10, targetSets = 4): PerformanceSnapshot => ({
  sessionId: "s1",
  date: "2026-10-01",
  trackingType: "weight_reps",
  target: { sets: targetSets, repMin: 8, repMax },
  sets,
});

describe("Progression", () => {
  it("meldet Steigerung, wenn die obere Wiederholungszahl in allen Arbeitssätzen erreicht wurde", () => {
    expect(isProgressionReady(snapshot([set(18, 10), set(18, 10), set(18, 10), set(18, 10)]))).toBe(true);
  });

  it("keine Steigerung, wenn ein Satz darunter lag", () => {
    expect(isProgressionReady(snapshot([set(18, 10), set(18, 10), set(18, 9), set(18, 8)]))).toBe(false);
  });

  it("keine Steigerung, wenn nicht alle geplanten Sätze gemacht wurden", () => {
    expect(isProgressionReady(snapshot([set(18, 10), set(18, 10)]))).toBe(false);
  });

  it("+2 kg nur mit Planvorgabe und bei Grundübungen", () => {
    const ready = snapshot([set(18, 10), set(18, 10), set(18, 10), set(18, 10)]);
    expect(progressionStepKg(ready, 2)).toBe(2);
    expect(progressionStepKg(ready, undefined)).toBeUndefined();
    expect(progressionStepKg(snapshot([set(6, 15), set(6, 15), set(6, 15)], 15, 3), 2)).toBeUndefined();
  });

  it("erkennt Verbesserungen: mehr Gewicht oder mehr Wiederholungen beim gleichen Gewicht", () => {
    expect(isImprovement("weight_reps", [set(18, 10)], [set(20, 6)])).toBe(true);
    expect(isImprovement("weight_reps", [set(18, 10), set(18, 9)], [set(18, 10), set(18, 10)])).toBe(true);
    expect(isImprovement("weight_reps", [set(18, 10)], [set(18, 10)])).toBe(false);
    expect(isImprovement("reps", [set(undefined, 10)], [set(undefined, 12)])).toBe(true);
  });

  it("zählt Steigerungen nur gegenüber früheren Einheiten", () => {
    const session = (id: string, startedAt: string, weight: number): WorkoutSession => ({
      id,
      profileId: "p",
      planName: "Push",
      date: startedAt.slice(0, 10),
      startedAt,
      completedAt: startedAt,
      exercises: [
        { id: `${id}-e`, exerciseId: "db-flat-bench-press", name: { de: "x", en: "x" }, trackingType: "weight_reps", target: { sets: 1 }, sets: [set(weight, 10)] },
      ],
    });
    const a = session("a", "2026-09-28T10:00:00.000Z", 18);
    const b = session("b", "2026-10-01T10:00:00.000Z", 20);
    expect(countImprovements([a, b], [b])).toBe(1);
    expect(countImprovements([a], [a])).toBe(0);
  });
});
