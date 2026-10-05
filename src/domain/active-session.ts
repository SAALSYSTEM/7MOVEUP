import type { SessionTimers, WorkoutSession } from "@/domain/types";

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
  setTimer?: { exerciseIndex: number; setIndex: number; resume: TimerResume };
  /** Pausen-Timer läuft noch */
  rest?: { endAt: number; seconds: number; label: string };
  /** Zeit-Satz ist abgelaufen, während die App weg war → wurde abgehakt */
  completedWhileAway?: { exerciseIndex: number; setIndex: number };
};

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
  if (setTimer) {
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
