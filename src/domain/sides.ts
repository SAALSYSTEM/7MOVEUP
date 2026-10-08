import type { PerformanceSnapshot, SessionExercise, SetLog, Side } from "./types";

/**
 * „Je Seite“ (einseitige Übungen).
 *
 * Plan: `sets` = Sätze JE SEITE (3 × 10 je Seite = 3 Sätze). Im Training stehen dafür 2 × `sets`
 * Zeilen in `SessionExercise.sets`, immer paarweise: Zeile 2p und 2p + 1 gehören zu Satz p + 1.
 * Welche Seite eine Zeile hat, steht explizit in `SetLog.side` – sie wird nie aus der Position
 * abgeleitet, weil die Startseite von Einheit zu Einheit wechselt.
 * Ein Satz zählt erst, wenn beide Seiten erledigt sind.
 */

/** Wechselpause zwischen den Seiten (Zeitübungen), wenn der Plan nichts anderes vorgibt */
export const DEFAULT_SWITCH_SEC = 5;
export const MAX_SWITCH_SEC = 60;
/** Startseite beim ersten Training einer Übung (oder wenn keine Seiteninformation vorliegt) */
export const FIRST_START_SIDE: Side = "left";

export const otherSide = (side: Side): Side => (side === "left" ? "right" : "left");

/** Gilt „Je Seite“ für diese Übung im Training? Cardio kennt keine Seiten. */
export function usesSides(entry: Pick<SessionExercise, "trackingType" | "target">): boolean {
  return entry.target.perSide === true && entry.trackingType !== "cardio";
}

/** Startseite der nächsten Einheit: die Gegenseite der letzten – ohne Vorgeschichte LINKS. */
export function nextStartSide(last: Pick<PerformanceSnapshot, "startSide"> | undefined): Side {
  return last?.startSide ? otherSide(last.startSide) : FIRST_START_SIDE;
}

/** Seiten der Zeilen eines Trainings: L,R,L,R,… bzw. R,L,R,L,… (Paare behalten ihre Reihenfolge). */
export function sideSequence(setCount: number, startSide: Side): Side[] {
  return Array.from({ length: setCount * 2 }, (_, i) => (i % 2 === 0 ? startSide : otherSide(startSide)));
}

/** Nummer des Satzes (ab 1), zu dem die Zeile gehört */
export const setNumber = (rowIndex: number): number => Math.floor(rowIndex / 2) + 1;

/** Die andere Zeile desselben Satzes */
export const partnerIndex = (rowIndex: number): number => (rowIndex % 2 === 0 ? rowIndex + 1 : rowIndex - 1);

/** Sind beide Seiten des Satzes erledigt, zu dem die Zeile gehört? */
export function isPairDone(sets: SetLog[], rowIndex: number): boolean {
  return Boolean(sets[rowIndex]?.done && sets[partnerIndex(rowIndex)]?.done);
}

/** Anzahl Sätze und erledigte Sätze – bei „Je Seite“ zählt nur ein vollständiges Paar. */
export function countSets(exercises: SessionExercise[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const entry of exercises) {
    if (usesSides(entry)) {
      const pairs = Math.floor(entry.sets.length / 2);
      total += pairs;
      for (let p = 0; p < pairs; p += 1) if (entry.sets[2 * p].done && entry.sets[2 * p + 1].done) done += 1;
    } else {
      total += entry.sets.length;
      done += entry.sets.filter((s) => s.done).length;
    }
  }
  return { done, total };
}

/** Haben die Sätze Seiteninformation? (Vergleich nur zwischen gleich aufgebauten Einheiten) */
export const hasSides = (sets: SetLog[]): boolean => sets.some((s) => s.side !== undefined);
