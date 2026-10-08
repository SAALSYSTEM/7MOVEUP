import { describe, expect, it } from "vitest";

import { buildSequence, markSidesDone, openRows, phaseAt, sideResults, totalSec, workSec } from "./side-sequence";
import type { SessionExercise } from "./types";

/** Side Plank, 2 Sätze je Seite à 30 s, Wechsel 5 s – vier Zeilen (L,R,L,R) */
const plank = (patch: Partial<SessionExercise> = {}): SessionExercise => ({
  id: "e1",
  exerciseId: "side-plank",
  name: { de: "Side Plank", en: "Side Plank" },
  trackingType: "duration",
  target: { sets: 2, durationSec: 30, restSec: 45, perSide: true, switchSec: 5 },
  sets: [
    { side: "left", durationSec: 30, done: false },
    { side: "right", durationSec: 30, done: false },
    { side: "left", durationSec: 30, done: false },
    { side: "right", durationSec: 30, done: false },
  ],
  ...patch,
});

describe("Folge für einen Satz „Je Seite“", () => {
  it("Seite → Wechsel → Seite → Satzpause", () => {
    const phases = buildSequence(plank(), [0, 1], 45);
    expect(phases.map((p) => p.kind)).toEqual(["work", "switch", "work", "rest"]);
    expect(phases.map((p) => p.sec)).toEqual([30, 5, 30, 45]);
    expect(totalSec(phases)).toBe(110);
    expect(workSec(phases)).toBe(65);
  });

  it("die Seiten kommen aus den Zeilen – bei Start RECHTS läuft RECHTS zuerst", () => {
    const entry = plank({
      sets: [
        { side: "right", durationSec: 30, done: false },
        { side: "left", durationSec: 30, done: false },
      ],
    });
    const phases = buildSequence(entry, [0, 1], 0);
    expect(phases.filter((p) => p.kind === "work").map((p) => (p.kind === "work" ? p.side : null))).toEqual(["right", "left"]);
  });

  it("Wechsel 0 s und Pause 0 s entfallen", () => {
    const entry = plank({ target: { sets: 2, durationSec: 30, perSide: true, switchSec: 0 } });
    expect(buildSequence(entry, [0, 1], 0).map((p) => p.kind)).toEqual(["work", "work"]);
  });

  it("ohne switchSec gilt der Standard von 5 s", () => {
    const entry = plank({ target: { sets: 2, durationSec: 30, perSide: true } });
    expect(buildSequence(entry, [0, 1], 0)[1]).toEqual({ kind: "switch", sec: 5 });
  });

  it("jede Seite läuft so lange, wie in ihrer Zeile steht", () => {
    const entry = plank();
    entry.sets[0] = { ...entry.sets[0], durationSec: 40 };
    expect(buildSequence(entry, [0, 1], 0).map((p) => p.sec)).toEqual([40, 5, 30]);
  });

  it("eine bereits erledigte Seite läuft nicht noch einmal", () => {
    const entry = plank();
    entry.sets[0] = { ...entry.sets[0], done: true };
    expect(openRows(entry, 0)).toEqual([1]);
    const phases = buildSequence(entry, openRows(entry, 0), 45);
    expect(phases.map((p) => p.kind)).toEqual(["work", "rest"]);
    expect(phases[0]).toMatchObject({ side: "right", rowIndex: 1 });
    expect(openRows(entry, 2)).toEqual([2, 3]);
  });

  it("phaseAt: Grenzen und Ende", () => {
    const phases = buildSequence(plank(), [0, 1], 45);
    expect(phaseAt(phases, 0)).toMatchObject({ index: 0, leftMs: 30_000, finished: false });
    expect(phaseAt(phases, 29_999)).toMatchObject({ index: 0, leftMs: 1, finished: false });
    expect(phaseAt(phases, 30_000)).toMatchObject({ index: 1, leftMs: 5_000 });
    expect(phaseAt(phases, 36_000)).toMatchObject({ index: 2, leftMs: 29_000 });
    expect(phaseAt(phases, 65_000)).toMatchObject({ index: 3, leftMs: 45_000 });
    expect(phaseAt(phases, 110_000)).toMatchObject({ index: 3, leftMs: 0, finished: true });
    expect(phaseAt(phases, 999_000).finished).toBe(true);
  });

  it("sideResults: nur begonnene Seiten, ganze Sekunden", () => {
    const phases = buildSequence(plank(), [0, 1], 45);
    expect(sideResults(phases, 0)).toEqual([]);
    expect(sideResults(phases, 12_400)).toEqual([{ rowIndex: 0, sec: 12, endMs: 12_400 }]);
    // im Wechsel: links vollständig, rechts nicht begonnen
    expect(sideResults(phases, 33_000)).toEqual([{ rowIndex: 0, sec: 30, endMs: 30_000 }]);
    expect(sideResults(phases, 50_000)).toEqual([
      { rowIndex: 0, sec: 30, endMs: 30_000 },
      { rowIndex: 1, sec: 15, endMs: 50_000 },
    ]);
    // in der Satzpause: beide vollständig
    expect(sideResults(phases, 80_000).map((r) => r.sec)).toEqual([30, 30]);
  });

  it("sideResults mit completeOnly lässt die laufende Seite aus", () => {
    const phases = buildSequence(plank(), [0, 1], 45);
    expect(sideResults(phases, 50_000, true)).toEqual([{ rowIndex: 0, sec: 30, endMs: 30_000 }]);
    expect(sideResults(phases, 65_000, true).map((r) => r.rowIndex)).toEqual([0, 1]);
  });

  it("markSidesDone: hakt nur ab, was noch offen ist – ein halber Satz zählt nicht als Satz", () => {
    const entry = plank();
    const phases = buildSequence(entry, [0, 1], 45);
    const origin = Date.parse("2026-10-05T08:00:00Z");
    const left = markSidesDone(entry, sideResults(phases, 40_000, true), origin);
    expect(left.sets.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(left.sets[0].completedAt).toBe(new Date(origin + 30_000).toISOString());
    const again = markSidesDone(left, sideResults(phases, 40_000, true), origin);
    expect(again).toBe(left);
    const both = markSidesDone(left, sideResults(phases, 65_000, true), origin);
    expect(both.sets.map((s) => s.done)).toEqual([true, true, false, false]);
    expect(both.sets[0].completedAt).toBe(left.sets[0].completedAt);
  });
});
