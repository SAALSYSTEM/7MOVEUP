import { hasSides } from "@/domain/sides";
import type { PerformanceSnapshot, SetLog, TrackingType, WorkoutSession } from "@/domain/types";

/**
 * V1-Regel: Wurde die obere Wiederholungszahl in ALLEN Arbeitssätzen erreicht,
 * ist eine Steigerung möglich. Reiner Hinweis – es wird nichts automatisch geändert.
 */
export function isProgressionReady(last: PerformanceSnapshot | undefined): boolean {
  if (!last) return false;
  if (last.trackingType !== "weight_reps" && last.trackingType !== "reps") return false;
  const repMax = last.target.repMax;
  if (!repMax) return false;
  const workingSets = last.sets.filter((s) => s.done);
  const required = last.target.perSide ? last.target.sets * 2 : last.target.sets;
  if (workingSets.length === 0 || workingSets.length < required) return false;
  return workingSets.every((s) => (s.reps ?? 0) >= repMax);
}

/**
 * Kg-Empfehlung nur bei Grundübungen (oberes Ziel ≤ 12 Wdh.) und wenn der Plan eine
 * Stufe vorgibt (4-Tage Kraft & Core: +2 kg). Isolationsübungen bekommen nur den Hinweis.
 */
export function progressionStepKg(
  last: PerformanceSnapshot | undefined,
  planStepKg: number | undefined,
): number | undefined {
  if (!planStepKg || !last || last.trackingType !== "weight_reps") return undefined;
  if ((last.target.repMax ?? 99) > 12) return undefined;
  return planStepKg;
}

type Score = { primary: number; secondary: number };

function score(trackingType: TrackingType, sets: SetLog[]): Score | undefined {
  const done = sets.filter((s) => s.done);
  if (done.length === 0) return undefined;
  const sum = (pick: (s: SetLog) => number | undefined) => done.reduce((acc, s) => acc + (pick(s) ?? 0), 0);
  const max = (pick: (s: SetLog) => number | undefined) => Math.max(...done.map((s) => pick(s) ?? 0));

  switch (trackingType) {
    case "weight_reps": {
      const top = max((s) => s.weightPerDumbbellKg);
      const repsAtTop = done
        .filter((s) => (s.weightPerDumbbellKg ?? 0) === top)
        .reduce((acc, s) => acc + (s.reps ?? 0), 0);
      return { primary: top, secondary: repsAtTop };
    }
    case "reps":
      return { primary: sum((s) => s.reps), secondary: max((s) => s.reps) };
    case "duration":
      return { primary: sum((s) => s.durationSec), secondary: max((s) => s.weightPerDumbbellKg) };
    case "cardio":
      return { primary: sum((s) => s.durationSec), secondary: max((s) => s.watts) };
  }
}

/** true, wenn die heutige Leistung besser ist als die vorherige */
export function isImprovement(trackingType: TrackingType, previous: SetLog[], current: SetLog[]): boolean {
  // „Je Seite“ verdoppelt die Summen – nur gleich aufgebaute Einheiten sind vergleichbar
  if (hasSides(previous) !== hasSides(current)) return false;
  const before = score(trackingType, previous);
  const now = score(trackingType, current);
  if (!before || !now) return false;
  if (now.primary !== before.primary) return now.primary > before.primary;
  return now.secondary > before.secondary;
}

/**
 * Anzahl Steigerungen in den angegebenen Sessions: pro Übung und Training
 * wird mit dem jeweils letzten vorherigen Auftreten verglichen.
 */
export function countImprovements(allCompleted: WorkoutSession[], inRange: WorkoutSession[]): number {
  const sorted = [...allCompleted].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let count = 0;
  for (const session of inRange) {
    for (const exercise of session.exercises) {
      const previous = findPrevious(sorted, exercise.exerciseId, session.startedAt);
      if (previous && isImprovement(exercise.trackingType, previous, exercise.sets)) count += 1;
    }
  }
  return count;
}

function findPrevious(sorted: WorkoutSession[], exerciseId: string, beforeIso: string): SetLog[] | undefined {
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const session = sorted[i];
    if (session.startedAt >= beforeIso) continue;
    const entry = session.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (entry) return entry.sets;
  }
  return undefined;
}
