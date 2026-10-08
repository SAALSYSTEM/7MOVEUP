import { buildSequence, markSidesDone, sideResults } from "@/domain/side-sequence";
import type { SessionExercise, SessionTimers, SetTimerState, WorkoutSession } from "@/domain/types";

/** Ein offenes Training gilt beim App-Start als „läuft noch“, wenn es vor höchstens so vielen Stunden begann. */
export const RESUME_WITHIN_HOURS = 6;

/** Nach einem Neustart der App direkt in dieses Training springen? */
export function isResumableSession(session: WorkoutSession | undefined, now: Date): session is WorkoutSession {
  if (!session || session.completedAt) return false;
  const started = new Date(session.startedAt).getTime();
  if (!Number.isFinite(started)) return false;
  const age = now.getTime() - started;
  return age >= 0 && age <= RESUME_WITHIN_HOURS * 60 * 60 * 1000;
}

export type TimerResume = { status: "running"; endAt: number } | { status: "paused"; remainingMs: number };

export type RestoredTimers = {
  /** ggf. angepasstes Training (abgelaufener Zeit-Satz abgehakt, veraltete Timer entfernt) */
  session: WorkoutSession;
  /** muss gespeichert werden */
  changed: boolean;
  /** Zeit-Timer wieder öffnen */
  setTimer?: { exerciseIndex: number; setIndex: number; resume: TimerResume; sequence?: SetTimerState["sequence"] };
  /** Pausen-Timer läuft noch */
  rest?: { endAt: number; seconds: number; label: string };
  /** Zeit-Satz ist abgelaufen, während die App weg war → wurde abgehakt */
  completedWhileAway?: { exerciseIndex: number; setIndex: number };
};

/**
 * „Je Seite“-Zeitsatz (ein Timer für Seite → Wechsel → Seite → Satzpause): fertig gelaufene Seiten
 * abhaken – auch die, die nur in der Zeit liefen, als die App weg war. `resume` nur, wenn der Timer
 * noch läuft bzw. pausiert ist; `undefined` = gespeicherter Timer ist ungültig.
 */
function restoreSideTimer(
  entry: SessionExercise,
  timer: SetTimerState,
  sequence: NonNullable<SetTimerState["sequence"]>,
  now: number,
): { entry: SessionExercise; resume?: TimerResume } | undefined {
  const { rows, restSec } = sequence;
  const valid =
    rows.length >= 1 && rows.length <= 2 && rows.every((row) => Number.isInteger(row) && entry.sets[row] !== undefined) && restSec >= 0;
  if (!valid) return undefined;
  const phases = buildSequence(entry, rows, restSec);
  const totalMs = timer.durationSec * 1000;
  if (timer.status === "running") {
    const endAt = timer.endAt ? new Date(timer.endAt).getTime() : NaN;
    if (!Number.isFinite(endAt)) return undefined;
    const startMs = endAt - totalMs;
    const done = markSidesDone(entry, sideResults(phases, Math.min(now - startMs, totalMs), true), startMs);
    return endAt > now ? { entry: done, resume: { status: "running", endAt } } : { entry: done };
  }
  if (typeof timer.remainingMs === "number" && timer.remainingMs > 0) {
    const elapsed = Math.max(0, totalMs - timer.remainingMs);
    const done = markSidesDone(entry, sideResults(phases, elapsed, true), now - elapsed);
    return { entry: done, resume: { status: "paused", remainingMs: timer.remainingMs } };
  }
  return undefined;
}

/**
 * Beim Öffnen eines Trainings: gespeicherte Timer auswerten.
 * - Zeit-Timer läuft noch → mit Restzeit weiter; pausiert → pausiert wieder öffnen
 * - Zeit-Timer ist abgelaufen → Satz mit der vollen Zeit abhaken (wie bei 0:00 in der App)
 * - Pausen-Timer läuft noch → weiter; abgelaufen → verwerfen
 */
export function restoreTimers(session: WorkoutSession, now: number): RestoredTimers {
  const timers = session.timers;
  if (!timers) return { session, changed: false };
  if (!timers.set && !timers.rest) return { session: { ...session, timers: undefined }, changed: true };

  let exercises = session.exercises;
  const nextTimers: SessionTimers = {};
  const result: Omit<RestoredTimers, "session" | "changed"> = {};

  const setTimer = timers.set;
  const sideEntry = setTimer?.sequence ? exercises.find((e) => e.id === setTimer.entryId) : undefined;
  if (setTimer?.sequence && sideEntry) {
    // „Je Seite“: schon abgehakte Seiten sind normal – die Folge läuft ggf. noch (Wechsel/Satzpause)
    const exerciseIndex = exercises.indexOf(sideEntry);
    const restored = restoreSideTimer(sideEntry, setTimer, setTimer.sequence, now);
    if (restored) {
      if (restored.entry !== sideEntry) exercises = exercises.map((e, i) => (i === exerciseIndex ? restored.entry : e));
      if (restored.resume) {
        nextTimers.set = setTimer;
        result.setTimer = { exerciseIndex, setIndex: setTimer.setIndex, resume: restored.resume, sequence: setTimer.sequence };
      } else if (restored.entry !== sideEntry) {
        result.completedWhileAway = { exerciseIndex, setIndex: setTimer.setIndex };
      }
    }
  } else if (setTimer) {
    const exerciseIndex = exercises.findIndex((e) => e.id === setTimer.entryId);
    const set = exercises[exerciseIndex]?.sets[setTimer.setIndex];
    if (set && !set.done) {
      const endAt = setTimer.endAt ? new Date(setTimer.endAt).getTime() : NaN;
      if (setTimer.status === "running" && Number.isFinite(endAt)) {
        if (endAt > now) {
          nextTimers.set = setTimer;
          result.setTimer = { exerciseIndex, setIndex: setTimer.setIndex, resume: { status: "running", endAt } };
        } else {
          exercises = exercises.map((entry, i) =>
            i === exerciseIndex
              ? {
                  ...entry,
                  sets: entry.sets.map((s, j) =>
                    j === setTimer.setIndex
                      ? { ...s, durationSec: setTimer.durationSec, done: true, completedAt: new Date(endAt).toISOString() }
                      : s,
                  ),
                }
              : entry,
          );
          result.completedWhileAway = { exerciseIndex, setIndex: setTimer.setIndex };
        }
      } else if (setTimer.status === "paused" && typeof setTimer.remainingMs === "number" && setTimer.remainingMs > 0) {
        nextTimers.set = setTimer;
        result.setTimer = { exerciseIndex, setIndex: setTimer.setIndex, resume: { status: "paused", remainingMs: setTimer.remainingMs } };
      }
    }
  }

  const rest = timers.rest;
  if (rest) {
    const endAt = new Date(rest.endAt).getTime();
    if (Number.isFinite(endAt) && endAt > now) {
      nextTimers.rest = rest;
      result.rest = { endAt, seconds: rest.seconds, label: rest.label };
    }
  }

  const keep = nextTimers.set || nextTimers.rest ? nextTimers : undefined;
  const changed = exercises !== session.exercises || keep?.set !== timers.set || keep?.rest !== timers.rest;
  return { session: { ...session, exercises, timers: keep }, changed, ...result };
}
