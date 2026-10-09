import { describe, expect, it } from "vitest";

import { countImprovements, isImprovement, progressionHint } from "./progression";
import type { PerformanceSnapshot, SessionExercise, SessionTarget, SetLog, Side, TrackingType, WorkoutSession } from "./types";

// ------------------------------------------------------------------ Bausteine

/** `null` = kein Gewicht eingetragen */
const row = (reps: number, weight: number | null = 10, side?: Side): SetLog => ({
  weightPerDumbbellKg: weight ?? undefined,
  reps,
  done: true,
  ...(side ? { side } : {}),
});
const rows = (reps: number[], weight: number | null = 10): SetLog[] => reps.map((r) => row(r, weight));
const secs = (values: number[], weight?: number): SetLog[] =>
  values.map((durationSec) => ({ durationSec, ...(weight !== undefined ? { weightPerDumbbellKg: weight } : {}), done: true }));
/** Je Seite: Paare links/rechts je Satz */
const sided = (left: number[], right: number[], weight: number | null = 10): SetLog[] =>
  left.flatMap((l, i) => [row(l, weight, "left"), row(right[i], weight, "right")]);

const target = (patch: Partial<SessionTarget> = {}): SessionTarget => ({ sets: 3, repMin: 12, repMax: 15, ...patch });
const timeTarget = (patch: Partial<SessionTarget> = {}): SessionTarget => ({ sets: 3, durationSec: 30, ...patch });

const snap = (sets: SetLog[], t: SessionTarget = target(), trackingType: TrackingType = "weight_reps"): PerformanceSnapshot => ({
  sessionId: `s-${Math.random()}`,
  date: "2026-10-01",
  trackingType,
  target: t,
  sets,
});

/** heutige Übung: Sätze noch offen, mit dem vorbelegten Gewicht (`null` = keines) */
const today = (
  t: SessionTarget = target(),
  trackingType: TrackingType = "weight_reps",
  weight: number | null = 10,
): Pick<SessionExercise, "trackingType" | "target" | "sets"> => ({
  trackingType,
  target: t,
  sets: Array.from({ length: t.perSide ? t.sets * 2 : t.sets }, () => ({
    ...(weight !== null ? { weightPerDumbbellKg: weight } : {}),
    reps: t.repMin,
    durationSec: t.durationSec,
    done: false,
  })),
});

const hint = (entry: ReturnType<typeof today>, ...recent: PerformanceSnapshot[]) => progressionHint(entry, recent);

// ------------------------------------------------------------------ 2×-Regel

describe("2×-Regel: Gewicht + Wiederholungen", () => {
  it("Fall A: obere Grenze in zwei vergleichbaren Einheiten → Gewicht prüfen, ggf. erhöhen", () => {
    expect(hint(today(), snap(rows([15, 15, 15])), snap(rows([15, 15, 15])))).toEqual({ subject: "weight", direction: "up" });
  });

  it("mehr als die obere Grenze zählt auch als oben", () => {
    expect(hint(today(), snap(rows([16, 15, 17])), snap(rows([15, 15, 15])))).toEqual({ subject: "weight", direction: "up" });
  });

  it("Fall B: Untergrenze zweimal in allen Sätzen nicht erreicht → Gewicht prüfen, ggf. reduzieren", () => {
    expect(hint(today(), snap(rows([11, 11, 10])), snap(rows([11, 10, 10])))).toEqual({ subject: "weight", direction: "down" });
  });

  it("Fall C: alles dazwischen → kein Hinweis", () => {
    expect(hint(today(), snap(rows([15, 14, 12])), snap(rows([15, 14, 12])))).toBeUndefined();
    // einmal gut, einmal schlechter
    expect(hint(today(), snap(rows([15, 15, 15])), snap(rows([15, 14, 12])))).toBeUndefined();
    expect(hint(today(), snap(rows([11, 10, 10])), snap(rows([15, 15, 15])))).toBeUndefined();
    expect(hint(today(), snap(rows([15, 15, 15])), snap(rows([11, 10, 10])))).toBeUndefined();
  });

  it("ein einzelner schwächerer Satz reicht nicht für „reduzieren“ (Ermüdung im letzten Satz)", () => {
    const eightToTen = target({ repMin: 8, repMax: 10 });
    expect(hint(today(eightToTen), snap(rows([10, 9, 7]), eightToTen), snap(rows([10, 9, 7]), eightToTen))).toBeUndefined();
    expect(hint(today(eightToTen), snap(rows([7, 7, 6]), eightToTen), snap(rows([7, 7, 6]), eightToTen))).toEqual({
      subject: "weight",
      direction: "down",
    });
  });

  it("ein einzelner Satz unter der oberen Grenze reicht nicht für „erhöhen“", () => {
    expect(hint(today(), snap(rows([15, 15, 14])), snap(rows([15, 15, 15])))).toBeUndefined();
  });

  it("nur eine Einheit oder keine → kein Hinweis", () => {
    expect(hint(today(), snap(rows([15, 15, 15])))).toBeUndefined();
    expect(hint(today())).toBeUndefined();
  });

  it("es zählen genau die beiden letzten Einheiten – ältere ändern nichts", () => {
    const good = snap(rows([15, 15, 15]));
    const bad = snap(rows([11, 10, 10]));
    expect(hint(today(), good, good, bad)).toEqual({ subject: "weight", direction: "up" });
    expect(hint(today(), good, bad, good)).toBeUndefined();
  });

  it("feste Ziele (von = bis, z. B. 12–12): erreicht → erhöhen, darunter → reduzieren, gemischt → nichts", () => {
    const fixed = target({ repMin: 12, repMax: 12 });
    expect(hint(today(fixed), snap(rows([12, 12, 12]), fixed), snap(rows([12, 13, 12]), fixed))?.direction).toBe("up");
    expect(hint(today(fixed), snap(rows([11, 11, 10]), fixed), snap(rows([10, 11, 11]), fixed))?.direction).toBe("down");
    expect(hint(today(fixed), snap(rows([12, 12, 11]), fixed), snap(rows([12, 12, 11]), fixed))).toBeUndefined();
  });
});

describe("2×-Regel: gleiches Gewicht", () => {
  it("anderes Gewicht in den beiden letzten Einheiten → die Kette beginnt neu", () => {
    expect(hint(today(target(), "weight_reps", 12), snap(rows([15, 15, 15], 12)), snap(rows([15, 15, 15], 10)))).toBeUndefined();
  });

  it("nach der Steigerung genügen zwei Einheiten mit dem neuen Gewicht", () => {
    const entry = today(target(), "weight_reps", 12);
    expect(hint(entry, snap(rows([15, 15, 15], 12)), snap(rows([15, 15, 15], 12)), snap(rows([15, 15, 15], 10)))).toEqual({
      subject: "weight",
      direction: "up",
    });
  });

  it("eine abweichende Einheit dazwischen wird nicht überbrückt (10 kg · 12 kg · 10 kg)", () => {
    expect(
      hint(today(), snap(rows([15, 15, 15], 10)), snap(rows([15, 15, 15], 12)), snap(rows([15, 15, 15], 10))),
    ).toBeUndefined();
  });

  it("unterschiedliche Gewichte innerhalb einer Einheit → nicht auswertbar (12 / 12 / 10 kg)", () => {
    const mixed = snap([row(10, 12), row(10, 12), row(10, 10)], target({ repMin: 8, repMax: 10 }));
    const eightToTen = target({ repMin: 8, repMax: 10 });
    expect(hint(today(eightToTen, "weight_reps", 12), mixed, mixed)).toBeUndefined();
    expect(hint(today(eightToTen, "weight_reps", 12), mixed, snap(rows([10, 10, 10], 12), eightToTen))).toBeUndefined();
  });

  it("Gewicht fehlt → nicht auswertbar", () => {
    const noWeight = snap(rows([15, 15, 15], null));
    expect(hint(today(target(), "weight_reps", null), noWeight, noWeight)).toBeUndefined();
  });

  it("Kommagewichte werden auf 0,01 genau verglichen", () => {
    const entry = today(target(), "weight_reps", 12.5);
    expect(hint(entry, snap(rows([15, 15, 15], 12.5)), snap(rows([15, 15, 15], 12.5)))?.direction).toBe("up");
    expect(hint(entry, snap(rows([15, 15, 15], 12.5)), snap(rows([15, 15, 15], 12)))).toBeUndefined();
  });

  it("schon ein anderes Gewicht eingetragen → Hinweis verschwindet (erhöht oder reduziert)", () => {
    const up = [snap(rows([15, 15, 15])), snap(rows([15, 15, 15]))];
    expect(hint(today(target(), "weight_reps", 12), ...up)).toBeUndefined();
    expect(hint(today(target(), "weight_reps", 8), ...up)).toBeUndefined();
    expect(hint(today(target(), "weight_reps", 10), ...up)?.direction).toBe("up");
    // schon ein einzelner Satz mit anderem Gewicht genügt
    const partly = today();
    partly.sets[2] = { ...partly.sets[2], weightPerDumbbellKg: 12 };
    expect(hint(partly, ...up)).toBeUndefined();
  });
});

describe("2×-Regel: vergleichbar nur mit dem heutigen Ziel", () => {
  const good = (t: SessionTarget) => [snap(rows([15, 15, 15]), t), snap(rows([15, 15, 15]), t)];

  it("anderer Bereich (8–10 → 12–15): die alten Einheiten zählen nicht", () => {
    const old = target({ repMin: 8, repMax: 10 });
    expect(hint(today(), snap(rows([10, 10, 10]), old), snap(rows([10, 10, 10]), old))).toBeUndefined();
  });

  it("andere Satzzahl, anderes von/bis → kein Hinweis", () => {
    expect(hint(today(target({ sets: 4 })), ...good(target()))).toBeUndefined();
    expect(hint(today(target({ repMin: 10 })), ...good(target()))).toBeUndefined();
    expect(hint(today(target({ repMax: 16 })), ...good(target()))).toBeUndefined();
  });

  it("die beiden Einheiten müssen auch untereinander gleich sein", () => {
    expect(hint(today(), snap(rows([15, 15, 15]), target()), snap(rows([15, 15, 15]), target({ repMin: 10 })))).toBeUndefined();
  });

  it("pause, notiz und plan sind egal", () => {
    const withRest = target({ restSec: 60, note: "langsam" });
    expect(hint(today(target({ restSec: 45 })), ...good(withRest))?.direction).toBe("up");
  });

  it("zusätzliche oder fehlende Sätze → Einheit nicht auswertbar", () => {
    expect(hint(today(), snap(rows([15, 15, 15, 15])), snap(rows([15, 15, 15])))).toBeUndefined();
    expect(hint(today(), snap(rows([15, 15])), snap(rows([15, 15, 15])))).toBeUndefined();
  });

  it("nicht abgehakte Sätze zählen nicht mit", () => {
    const withOpen = snap([...rows([15, 15, 15]), { weightPerDumbbellKg: 10, reps: 12, done: false }]);
    expect(hint(today(), withOpen, snap(rows([15, 15, 15])))?.direction).toBe("up");
  });

  it("fehlende Zielwerte (von oder bis) → kein Hinweis", () => {
    const noMax = target({ repMax: undefined });
    const noMin = target({ repMin: undefined });
    expect(hint(today(noMax), ...good(noMax))).toBeUndefined();
    expect(hint(today(noMin), ...good(noMin))).toBeUndefined();
    expect(hint(today(target({ repMin: 16, repMax: 12 })), ...good(target({ repMin: 16, repMax: 12 })))).toBeUndefined();
  });

  it("fehlende Wiederholungen in einem Satz → nicht auswertbar", () => {
    const hole = snap([row(15), { weightPerDumbbellKg: 10, done: true }, row(15)]);
    expect(hint(today(), hole, snap(rows([15, 15, 15])))).toBeUndefined();
  });

  it("anderer Übungstyp oder Cardio → kein Hinweis", () => {
    expect(hint(today(target(), "weight_reps"), snap(rows([15, 15, 15]), target(), "reps"), snap(rows([15, 15, 15])))).toBeUndefined();
    const cardio = target({ sets: 1, durationSec: 1800 });
    const cardioSnap = snap([{ durationSec: 1800, done: true }], cardio, "cardio");
    expect(hint(today(cardio, "cardio"), cardioSnap, cardioSnap)).toBeUndefined();
  });
});

describe("2×-Regel: Je Seite", () => {
  const perSide = target({ perSide: true });
  const full = (l: number[], r: number[], weight?: number) => snap(sided(l, r, weight), perSide);

  it("beide Seiten in beiden Einheiten vollständig oben → erhöhen", () => {
    expect(hint(today(perSide), full([15, 15, 15], [15, 15, 15]), full([15, 15, 15], [16, 15, 15]))?.direction).toBe("up");
  });

  it("LINKS 15/15/15, RECHTS 15/14/15 → obere Grenze insgesamt nicht erreicht", () => {
    expect(hint(today(perSide), full([15, 15, 15], [15, 14, 15]), full([15, 15, 15], [15, 15, 15]))).toBeUndefined();
  });

  it("reduzieren nur, wenn alle Ausführungen beider Seiten unter von liegen", () => {
    expect(hint(today(perSide), full([11, 10, 10], [11, 11, 10]), full([10, 10, 10], [11, 10, 9]))?.direction).toBe("down");
    // eine Seite ok, die andere darunter: Seitenunterschied, kein Gewichtssignal
    expect(hint(today(perSide), full([13, 13, 12], [10, 10, 9]), full([13, 13, 12], [10, 10, 9]))).toBeUndefined();
  });

  it("fehlt eine Seite, ein Satz oder die Seitenangabe → nicht auswertbar", () => {
    const leftOnly = snap(rows([15, 15, 15, 15, 15, 15]).map((s) => ({ ...s, side: "left" as const })), perSide);
    const sixNoSide = snap(rows([15, 15, 15, 15, 15, 15]), perSide);
    const missingRow = snap(sided([15, 15, 15], [15, 15, 15]).slice(0, 5), perSide);
    const ok = full([15, 15, 15], [15, 15, 15]);
    expect(hint(today(perSide), leftOnly, ok)).toBeUndefined();
    expect(hint(today(perSide), sixNoSide, ok)).toBeUndefined();
    expect(hint(today(perSide), missingRow, ok)).toBeUndefined();
  });

  it("Je Seite und normal sind nie vergleichbar (fehlendes Je Seite = aus)", () => {
    const plain = [snap(rows([15, 15, 15])), snap(rows([15, 15, 15]))];
    expect(hint(today(perSide), ...plain)).toBeUndefined();
    expect(hint(today(target({ perSide: false })), ...plain)?.direction).toBe("up");
    expect(hint(today(target()), snap(rows([15, 15, 15]), target({ perSide: false })), snap(rows([15, 15, 15])))?.direction).toBe("up");
    expect(hint(today(target()), full([15, 15, 15], [15, 15, 15]), full([15, 15, 15], [15, 15, 15]))).toBeUndefined();
  });

  it("unterschiedliche Gewichte je Seite → nicht auswertbar", () => {
    const uneven = snap(sided([15, 15, 15], [15, 15, 15]).map((s) => (s.side === "right" ? { ...s, weightPerDumbbellKg: 8 } : s)), perSide);
    expect(hint(today(perSide), uneven, uneven)).toBeUndefined();
  });
});

describe("2×-Regel: Zeitübungen", () => {
  const t30 = timeTarget();
  const entry = (t = t30, weight: number | null = null) => today(t, "duration", weight);
  const sn = (values: number[], t = t30, weight?: number) => snap(secs(values, weight), t, "duration");

  it("alle Sätze zweimal Zielzeit erreicht → Zeit prüfen, ggf. erhöhen", () => {
    expect(hint(entry(), sn([30, 30, 30]), sn([32, 30, 31]))).toEqual({ subject: "time", direction: "up" });
  });

  it("alle Sätze zweimal unter der Zielzeit → Zeit prüfen, ggf. reduzieren", () => {
    expect(hint(entry(), sn([29, 28, 25]), sn([20, 25, 29]))).toEqual({ subject: "time", direction: "down" });
  });

  it("knapp verfehlt oder gemischt → kein Hinweis", () => {
    expect(hint(entry(), sn([30, 30, 29]), sn([30, 30, 29]))).toBeUndefined();
    expect(hint(entry(), sn([30, 30, 22]), sn([30, 30, 22]))).toBeUndefined();
    expect(hint(entry(), sn([30, 30, 30]), sn([29, 28, 25]))).toBeUndefined();
  });

  it("andere Zielzeit oder Satzzahl → nicht vergleichbar", () => {
    expect(hint(entry(timeTarget({ durationSec: 40 })), sn([40, 40, 40], t30), sn([40, 40, 40], t30))).toBeUndefined();
    expect(hint(entry(timeTarget({ sets: 2 })), sn([30, 30, 30]), sn([30, 30, 30]))).toBeUndefined();
  });

  it("fehlende Zielzeit oder Zeit im Satz → kein Hinweis", () => {
    const none = timeTarget({ durationSec: undefined });
    expect(hint(entry(none), sn([30, 30, 30], none), sn([30, 30, 30], none))).toBeUndefined();
    const hole = snap([{ durationSec: 30, done: true }, { done: true }, { durationSec: 30, done: true }], t30, "duration");
    expect(hint(entry(), hole, sn([30, 30, 30]))).toBeUndefined();
  });

  it("Je Seite: beide Seiten zählen", () => {
    const side = timeTarget({ sets: 2, perSide: true, switchSec: 5 });
    const mk = (l: number[], r: number[]) =>
      snap(l.flatMap((v, i) => [{ durationSec: v, done: true, side: "left" as const }, { durationSec: r[i], done: true, side: "right" as const }]), side, "duration");
    const e = entry(side);
    expect(hint(e, mk([30, 30], [30, 30]), mk([30, 31], [30, 30]))?.direction).toBe("up");
    expect(hint(e, mk([30, 30], [30, 28]), mk([30, 30], [30, 30]))).toBeUndefined();
    expect(hint(e, mk([25, 20], [28, 29]), mk([29, 29], [10, 25]))?.direction).toBe("down");
  });

  it("mit Gewicht (z. B. Zusatzgewicht): gleiches Gewicht nötig, anderes heutiges Gewicht blendet aus", () => {
    expect(hint(entry(t30, 8), sn([30, 30, 30], t30, 8), sn([30, 30, 30], t30, 8))?.direction).toBe("up");
    expect(hint(entry(t30, 8), sn([30, 30, 30], t30, 8), sn([30, 30, 30], t30, 6))).toBeUndefined();
    expect(hint(entry(t30, 10), sn([30, 30, 30], t30, 8), sn([30, 30, 30], t30, 8))).toBeUndefined();
    // ohne Gewicht in der Historie, aber heute eines vorbelegt: geändert
    expect(hint(entry(t30, 5), sn([30, 30, 30]), sn([30, 30, 30]))).toBeUndefined();
  });
});

describe("2×-Regel: Wiederholungen ohne Gewicht", () => {
  const body = target({ repMin: 10, repMax: 12 });
  const rep = (values: number[]) => snap(values.map((reps) => ({ reps, done: true })), body, "reps");
  const entry = () => ({
    trackingType: "reps" as const,
    target: body,
    sets: [{ reps: 10, done: false }, { reps: 10, done: false }, { reps: 10, done: false }],
  });

  it("zweimal oben → Schwierigkeit prüfen, ggf. erhöhen", () => {
    expect(progressionHint(entry(), [rep([12, 12, 12]), rep([12, 13, 12])])).toEqual({ subject: "difficulty", direction: "up" });
  });

  it("zweimal alle Sätze unten → Schwierigkeit prüfen, ggf. reduzieren", () => {
    expect(progressionHint(entry(), [rep([9, 8, 8]), rep([9, 9, 7])])).toEqual({ subject: "difficulty", direction: "down" });
  });

  it("dazwischen → kein Hinweis; Gewicht spielt keine Rolle", () => {
    expect(progressionHint(entry(), [rep([12, 11, 10]), rep([12, 12, 12])])).toBeUndefined();
    expect(progressionHint(entry(), [rep([12, 12, 12]), rep([12, 12, 12])])?.direction).toBe("up");
  });
});

// ------------------------------------------------------------------ Verbesserungs-Zähler (Home) – unverändert

describe("Steigerungen (Home-Zähler)", () => {
  it("erkennt Verbesserungen: mehr Gewicht oder mehr Wiederholungen beim gleichen Gewicht", () => {
    expect(isImprovement("weight_reps", [row(10, 18)], [row(6, 20)])).toBe(true);
    expect(isImprovement("weight_reps", [row(10, 18), row(9, 18)], [row(10, 18), row(10, 18)])).toBe(true);
    expect(isImprovement("weight_reps", [row(10, 18)], [row(10, 18)])).toBe(false);
    expect(isImprovement("reps", [row(10, null)], [row(12, null)])).toBe(true);
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
        { id: `${id}-e`, exerciseId: "db-flat-bench-press", name: { de: "x", en: "x" }, trackingType: "weight_reps", target: { sets: 1 }, sets: [row(10, weight)] },
      ],
    });
    const a = session("a", "2026-09-28T10:00:00.000Z", 18);
    const b = session("b", "2026-10-01T10:00:00.000Z", 20);
    expect(countImprovements([a, b], [b])).toBe(1);
    expect(countImprovements([a], [a])).toBe(0);
  });
});
