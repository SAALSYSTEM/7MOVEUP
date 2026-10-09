import { hasSides } from "@/domain/sides";
import type {
  PerformanceSnapshot,
  SessionExercise,
  SessionTarget,
  SetLog,
  TrackingType,
  WorkoutSession,
} from "@/domain/types";

/**
 * Die 2×-Regel. 7MOVEUP ändert nie selbst Gewicht, Wiederholungen oder Zeit – es weist nur darauf hin,
 * wenn zwei vergleichbare Einheiten hintereinander dasselbe eindeutige Bild zeigen:
 *
 *   oben  = JEDER Satz erreicht die obere Grenze (Wdh. bis bzw. Zielzeit)   → „… prüfen – ggf. erhöhen“
 *   unten = JEDER Satz liegt unter der unteren Grenze (Wdh. von bzw. Zielzeit) → „… prüfen – ggf. reduzieren“
 *   alles dazwischen → kein Hinweis
 *
 * Es wird nichts gespeichert: Der Hinweis folgt allein aus den beiden letzten Einheiten dieser Übung und
 * dem heutigen Ziel. Wechselt das Gewicht oder ändert sich der Plan, sind die Einheiten nicht mehr gleich –
 * die „Kette“ beginnt damit von selbst neu. Im Zweifel (unvollständige Daten) gibt es keinen Hinweis.
 */
export const REQUIRED_SESSIONS = 2;

export type ProgressionHint = {
  /** Gewicht (Wiederholungen mit Gewicht), Zeit (Zeitübung) oder Schwierigkeit (Wiederholungen ohne Gewicht) */
  subject: "weight" | "time" | "difficulty";
  direction: "up" | "down";
};

type Level = "top" | "bottom" | "mid";
type Range = { lo: number; hi: number };
type Assessment = { level: Level; weight: string };

const positive = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
/** Gewichte vergleichen wir auf 0,01 genau; "" = kein Gewicht eingetragen */
const weightKey = (kg: number | undefined) => (typeof kg === "number" && Number.isFinite(kg) ? String(Math.round(kg * 100)) : "");

/** Grenzen, an denen ein Satz gemessen wird – fehlt eine, gibt es keinen Hinweis. Zeit hat nur ein Ziel (lo = hi). */
function rangeFor(trackingType: TrackingType, target: SessionTarget): Range | undefined {
  if (trackingType === "weight_reps" || trackingType === "reps") {
    const { repMin, repMax } = target;
    return positive(repMin) && positive(repMax) && repMin <= repMax ? { lo: repMin, hi: repMax } : undefined;
  }
  if (trackingType === "duration") {
    return positive(target.durationSec) ? { lo: target.durationSec, hi: target.durationSec } : undefined;
  }
  return undefined;
}

/** Vergleichbar nur bei gleicher Satzzahl, gleichem Je-Seite-Status und gleichem Ziel (fehlendes Je Seite = aus). */
function sameTarget(trackingType: TrackingType, a: SessionTarget, b: SessionTarget): boolean {
  if (a.sets !== b.sets || Boolean(a.perSide) !== Boolean(b.perSide)) return false;
  return trackingType === "duration" ? a.durationSec === b.durationSec : a.repMin === b.repMin && a.repMax === b.repMax;
}

/**
 * Wie eine vergangene Einheit einzustufen ist – oder `undefined`, wenn sie nicht auswertbar ist:
 * anderes Ziel als heute, nicht genau die geplanten Sätze erledigt (mehr oder weniger; bei Je Seite je Seite),
 * fehlende Werte oder unterschiedliche Gewichte in den Sätzen.
 */
function assess(
  snapshot: PerformanceSnapshot,
  entry: Pick<SessionExercise, "trackingType" | "target">,
  range: Range,
): Assessment | undefined {
  const { trackingType, target } = entry;
  if (snapshot.trackingType !== trackingType || !sameTarget(trackingType, snapshot.target, target)) return undefined;

  const sets = snapshot.sets.filter((s) => s.done);
  const perSide = Boolean(target.perSide);
  if (sets.length !== target.sets * (perSide ? 2 : 1)) return undefined;
  if (perSide && (["left", "right"] as const).some((side) => sets.filter((s) => s.side === side).length !== target.sets)) {
    return undefined;
  }

  const values = sets.map((s) => (trackingType === "duration" ? s.durationSec : s.reps));
  if (!values.every((v): v is number => typeof v === "number" && Number.isFinite(v))) return undefined;

  // „Wiederholungen ohne Gewicht“ hat kein Gewicht; sonst müssen alle Sätze genau dasselbe Gewicht haben
  const weights = new Set(sets.map((s) => (trackingType === "reps" ? "" : weightKey(s.weightPerDumbbellKg))));
  if (weights.size !== 1) return undefined;
  const weight = [...weights][0];
  if (trackingType === "weight_reps" && weight === "") return undefined;

  if (values.every((v) => v >= range.hi)) return { level: "top", weight };
  if (values.every((v) => v < range.lo)) return { level: "bottom", weight };
  return { level: "mid", weight };
}

/**
 * Hinweis für die heutige Übung. `recent` = die letzten Einheiten dieser Übung, neueste zuerst. Es zählen genau
 * die beiden letzten – eine abweichende Einheit dazwischen unterbricht die Kette. Sobald heute schon ein
 * anderes Gewicht eingetragen ist, ist der Hinweis überholt und verschwindet.
 */
export function progressionHint(
  entry: Pick<SessionExercise, "trackingType" | "target" | "sets">,
  recent: PerformanceSnapshot[],
): ProgressionHint | undefined {
  const range = rangeFor(entry.trackingType, entry.target);
  if (!range || !positive(entry.target.sets) || recent.length < REQUIRED_SESSIONS) return undefined;

  const assessed = recent.slice(0, REQUIRED_SESSIONS).map((snapshot) => assess(snapshot, entry, range));
  const first = assessed[0];
  if (!first || first.level === "mid") return undefined;
  if (!assessed.every((a) => a !== undefined && a.level === first.level && a.weight === first.weight)) return undefined;

  if (entry.trackingType !== "reps" && entry.sets.some((s) => weightKey(s.weightPerDumbbellKg) !== first.weight)) {
    return undefined;
  }

  const subject = entry.trackingType === "weight_reps" ? "weight" : entry.trackingType === "duration" ? "time" : "difficulty";
  return { subject, direction: first.level === "top" ? "up" : "down" };
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
