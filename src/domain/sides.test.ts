import { describe, expect, it } from "vitest";

import { isImprovement } from "./progression";
import { countSets, nextStartSide, otherSide, partnerIndex, setNumber, sideSequence, usesSides } from "./sides";
import type { SessionExercise, SetLog, Side } from "./types";

const row = (side: Side | undefined, done: boolean, reps = 10): SetLog => ({ reps, done, ...(side ? { side } : {}) });

const entry = (sets: SetLog[], perSide = true, trackingType: SessionExercise["trackingType"] = "reps"): SessionExercise => ({
  id: "e",
  exerciseId: "x",
  name: { de: "X", en: "X" },
  trackingType,
  target: { sets: Math.ceil(sets.length / (perSide ? 2 : 1)), perSide: perSide || undefined },
  sets,
});

describe("Je Seite – Grundregeln", () => {
  it("Cardio und Übungen ohne perSide kennen keine Seiten", () => {
    expect(usesSides(entry([row("left", false), row("right", false)]))).toBe(true);
    expect(usesSides(entry([row(undefined, false)], false))).toBe(false);
    expect(usesSides(entry([row("left", false), row("right", false)], true, "cardio"))).toBe(false);
  });

  it("Startseite: erstes Mal LINKS, danach wechselt sie; ohne Seiteninformation wieder LINKS", () => {
    expect(nextStartSide(undefined)).toBe("left");
    expect(nextStartSide({ startSide: undefined })).toBe("left");
    expect(nextStartSide({ startSide: "left" })).toBe("right");
    expect(nextStartSide({ startSide: "right" })).toBe("left");
    expect(otherSide("left")).toBe("right");
  });

  it("Zeilenfolge: Paare behalten die Reihenfolge der Startseite", () => {
    expect(sideSequence(3, "left")).toEqual(["left", "right", "left", "right", "left", "right"]);
    expect(sideSequence(2, "right")).toEqual(["right", "left", "right", "left"]);
  });

  it("Satznummer und Partnerzeile", () => {
    expect([0, 1, 2, 3, 4, 5].map(setNumber)).toEqual([1, 1, 2, 2, 3, 3]);
    expect([0, 1, 2, 3].map(partnerIndex)).toEqual([1, 0, 3, 2]);
  });
});

describe("Je Seite – Zählung: Links + Rechts = ein Satz", () => {
  it("eine einzelne erledigte Seite zählt nicht als Satz", () => {
    const e = entry([row("left", true), row("right", false), row("left", false), row("right", false)]);
    expect(countSets([e])).toEqual({ done: 0, total: 2 });
  });

  it("erst beide Seiten ergeben einen erledigten Satz", () => {
    const e = entry([row("left", true), row("right", true), row("left", true), row("right", false), row("left", false), row("right", false)]);
    expect(countSets([e])).toEqual({ done: 1, total: 3 });
  });

  it("Übungen ohne Seiten zählen wie bisher, gemischt mit Paaren", () => {
    const plain = entry([row(undefined, true), row(undefined, true), row(undefined, false)], false);
    const paired = entry([row("right", true), row("left", true)]);
    expect(countSets([plain, paired])).toEqual({ done: 3, total: 4 });
  });
});

describe("Je Seite – Verbesserungen bleiben korrekt", () => {
  it("Umstellen auf Je Seite wirkt nicht wie doppelte Leistung (keine falsche Steigerung)", () => {
    const before = [row(undefined, true, 10), row(undefined, true, 10)];
    const now = [row("left", true, 10), row("right", true, 10), row("left", true, 10), row("right", true, 10)];
    expect(isImprovement("reps", before, now)).toBe(false);
    // gleich aufgebaut: normaler Vergleich
    expect(isImprovement("reps", now, [row("left", true, 12), row("right", true, 12)])).toBe(false);
    expect(isImprovement("reps", now, [...now, row("left", true, 10), row("right", true, 10)])).toBe(true);
  });
});
