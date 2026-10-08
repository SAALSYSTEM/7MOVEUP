import { DEFAULT_SWITCH_SEC, otherSide } from "./sides";
import type { SessionExercise, Side } from "./types";

/**
 * Ablauf eines Satzes einer Zeitübung mit „Je Seite“ (z. B. Side Plank):
 * Seite → Wechsel → Seite → Satzpause. Er läuft als EIN Countdown mit einer Endzeit; welche Phase
 * gerade ist, wird nur aus der verstrichenen Zeit berechnet. So funktionieren Pause/Fortsetzen,
 * Sperrbildschirm und Neustart der App mit demselben gespeicherten Timer wie bei normalen Zeitsätzen.
 */

export type SequencePhase =
  | { kind: "work"; side: Side; rowIndex: number; sec: number }
  | { kind: "switch"; sec: number }
  | { kind: "rest"; sec: number };

/** Noch offene Zeilen des Satzes, dessen erste Zeile `firstRow` ist (eine bereits erledigte Seite läuft nicht noch einmal). */
export function openRows(entry: SessionExercise, firstRow: number): number[] {
  return [firstRow, firstRow + 1].filter((row) => entry.sets[row] !== undefined && !entry.sets[row].done);
}

/**
 * Phasen für die Zeilen `rows` (1 oder 2). Jede Seite läuft so lange, wie in ihrer Zeile steht
 * (Planwert, falls leer). Wechsel nur zwischen zwei Seiten und bei > 0 s, Satzpause nur bei `restSec` > 0.
 */
export function buildSequence(entry: SessionExercise, rows: number[], restSec: number): SequencePhase[] {
  const planned = entry.target.durationSec ?? 30;
  const switchSec = Math.max(0, Math.round(entry.target.switchSec ?? DEFAULT_SWITCH_SEC));
  const phases: SequencePhase[] = [];
  let previous: Side | undefined;
  rows.forEach((rowIndex, i) => {
    const set = entry.sets[rowIndex];
    // die Seite steht in der Zeile; nur bei kaputten Daten ersatzweise LINKS bzw. die Gegenseite
    const side: Side = set?.side ?? (previous ? otherSide(previous) : "left");
    if (i > 0 && switchSec > 0) phases.push({ kind: "switch", sec: switchSec });
    phases.push({ kind: "work", side, rowIndex, sec: Math.max(1, Math.round(set?.durationSec ?? planned)) });
    previous = side;
  });
  if (restSec > 0) phases.push({ kind: "rest", sec: Math.round(restSec) });
  return phases;
}

export const totalSec = (phases: SequencePhase[]): number => phases.reduce((acc, p) => acc + p.sec, 0);

/** Sekunden bis zum Ende der letzten Seite (danach folgt höchstens noch die Satzpause) */
export function workSec(phases: SequencePhase[]): number {
  const lastWork = phases.map((p) => p.kind).lastIndexOf("work");
  return phases.slice(0, lastWork + 1).reduce((acc, p) => acc + p.sec, 0);
}

export type PhasePosition = {
  index: number;
  phase: SequencePhase;
  /** Millisekunden bis zum Ende dieser Phase */
  leftMs: number;
  /** Folge zu Ende */
  finished: boolean;
};

/** Welche Phase läuft nach `elapsedMs` – am Ende bleibt es bei der letzten Phase mit 0 ms. */
export function phaseAt(phases: SequencePhase[], elapsedMs: number): PhasePosition {
  let start = 0;
  for (let index = 0; index < phases.length; index += 1) {
    const end = start + phases[index].sec * 1000;
    if (elapsedMs < end) return { index, phase: phases[index], leftMs: end - Math.max(elapsedMs, start), finished: false };
    start = end;
  }
  const index = phases.length - 1;
  return { index, phase: phases[index], leftMs: 0, finished: true };
}

export type SideResult = { rowIndex: number; sec: number; endMs: number };

/**
 * Wie lange jede Seite nach `elapsedMs` tatsächlich gelaufen ist (ganze Sekunden) und wann sie
 * (frühestens) endete – nur Seiten, die begonnen wurden; mit `completeOnly` nur vollständig gelaufene.
 * Für „Übernehmen“ vor dem Ende, zum Abhaken fertiger Seiten und beim Wiederherstellen.
 */
export function sideResults(phases: SequencePhase[], elapsedMs: number, completeOnly = false): SideResult[] {
  const results: SideResult[] = [];
  let start = 0;
  for (const phase of phases) {
    const end = start + phase.sec * 1000;
    if (phase.kind === "work" && (!completeOnly || elapsedMs >= end)) {
      const ran = Math.min(Math.max(elapsedMs - start, 0), phase.sec * 1000);
      const sec = Math.round(ran / 1000);
      if (sec > 0) results.push({ rowIndex: phase.rowIndex, sec, endMs: start + ran });
    }
    start = end;
  }
  return results;
}

/** Seiten abhaken (Sekunden je Seite) – bereits erledigte Zeilen bleiben unverändert. `originMs` = Startzeit der Folge. */
export function markSidesDone(entry: SessionExercise, results: SideResult[], originMs: number): SessionExercise {
  let changed = false;
  const sets = entry.sets.map((set, index) => {
    const result = results.find((r) => r.rowIndex === index);
    if (!result || set.done) return set;
    changed = true;
    return { ...set, durationSec: result.sec, done: true, completedAt: new Date(originMs + result.endMs).toISOString() };
  });
  return changed ? { ...entry, sets } : entry;
}
