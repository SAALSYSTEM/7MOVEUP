import { exerciseRepository, profileRepository, workoutRepository } from "@/data";
import { DEFAULT_SWITCH_SEC, nextStartSide, sideSequence, usesSides } from "@/domain/sides";
import type {
  Exercise,
  PerformanceSnapshot,
  SessionExercise,
  SetLog,
  Side,
  WorkoutPlan,
  WorkoutPlanItem,
  WorkoutSession,
} from "@/domain/types";
import { createId } from "@/lib/id";
import { localDateKey } from "@/lib/dates";

/**
 * Wert vom letzten Mal für Satz `index` (ab 0). Bei Seiten zählt (Satz, Seite): Der Satz derselben Seite,
 * auch wenn diesmal die andere Seite beginnt. Ältere Einheiten ohne Seiten füllen beide Seiten nach Satznummer.
 */
function lastSetFor(last: PerformanceSnapshot | undefined, index: number, side?: Side): SetLog | undefined {
  if (!last) return undefined;
  if (side) {
    const sameSide = last.sets.filter((s) => s.side === side);
    if (sameSide.length > 0) return sameSide[index] ?? sameSide.at(-1);
  }
  return last.sets[index] ?? last.sets.at(-1);
}

function prefillSet(
  exercise: Exercise,
  item: WorkoutPlanItem,
  last: PerformanceSnapshot | undefined,
  index: number,
  side?: Side,
): SetLog {
  const lastSet = lastSetFor(last, index, side);
  const sideField = side ? { side } : {};
  switch (exercise.trackingType) {
    case "weight_reps":
      return {
        weightPerDumbbellKg: lastSet?.weightPerDumbbellKg ?? item.weightStepsKg?.[0],
        reps: lastSet?.reps ?? item.repMin ?? item.repMax ?? exercise.defaultRepMin,
        done: false,
        ...sideField,
      };
    case "reps":
      return { reps: lastSet?.reps ?? item.repMin ?? item.repMax ?? exercise.defaultRepMin, done: false, ...sideField };
    case "duration":
      return {
        durationSec: item.durationSec ?? exercise.defaultDurationSec ?? 30,
        weightPerDumbbellKg: lastSet?.weightPerDumbbellKg ?? item.weightStepsKg?.[0],
        done: false,
        ...sideField,
      };
    case "cardio":
      return {
        durationSec: item.durationSec ?? exercise.defaultDurationSec ?? 30 * 60,
        watts: lastSet?.watts,
        rpm: lastSet?.rpm,
        heartRate: lastSet?.heartRate,
        done: false,
      };
  }
}

async function buildSessionExercise(item: WorkoutPlanItem): Promise<SessionExercise | undefined> {
  const exercise = await exerciseRepository.getById(item.exerciseId);
  if (!exercise) return undefined;
  const last = await workoutRepository.getLastPerformance(exercise.id);
  const setCount = Math.max(1, item.sets);
  // „Je Seite“ gilt nur, wenn der Plan es ausdrücklich sagt (fehlendes perSide = false); Cardio kennt keine Seiten
  const perSide = item.perSide === true && exercise.trackingType !== "cardio";
  const sets = perSide
    ? // Zeilen paarweise: Satz 1 (Startseite, Gegenseite), Satz 2 (…) – die Startseite wechselt von Einheit zu Einheit
      sideSequence(setCount, nextStartSide(last)).map((side, row) => prefillSet(exercise, item, last, Math.floor(row / 2), side))
    : Array.from({ length: setCount }, (_, i) => prefillSet(exercise, item, last, i));
  return {
    id: createId(),
    exerciseId: exercise.id,
    name: exercise.name,
    trackingType: exercise.trackingType,
    target: {
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      durationSec: item.durationSec,
      restSec: item.restSec ?? exercise.defaultRestSec,
      weightStepsKg: item.weightStepsKg,
      perSide: perSide || undefined,
      switchSec: perSide && exercise.trackingType === "duration" ? (item.switchSec ?? DEFAULT_SWITCH_SEC) : undefined,
      note: item.note,
    },
    sets,
  };
}

/**
 * Training aus einem Trainingstag starten – zentral abgesichert: Läuft schon eines, wird nichts
 * angelegt, sondern das offene zurückgegeben (`created: false`). Die endgültige Prüfung passiert
 * atomar im Repository (`startSession`), die Vorab-Prüfung spart nur Arbeit.
 */
export async function startSessionFromPlan(
  plan: WorkoutPlan,
  date = new Date(),
): Promise<{ session: WorkoutSession; created: boolean }> {
  const open = await workoutRepository.getActiveSession();
  if (open) return { session: open, created: false };
  const profile = await profileRepository.getCurrent();
  const exercises = (await Promise.all(plan.items.map(buildSessionExercise))).filter(
    (e): e is SessionExercise => Boolean(e),
  );
  const session: WorkoutSession = {
    id: createId(),
    profileId: profile.id,
    planId: plan.id,
    planName: plan.name,
    date: localDateKey(date),
    startedAt: new Date().toISOString(),
    progressionStepKg: plan.progressionStepKg,
    exercises,
  };
  return workoutRepository.startSession(session);
}

function reopened(set: SetLog | undefined): SetLog {
  return { ...set, done: false, completedAt: undefined };
}

/** Zeilen für „Satz hinzufügen“: eine – bei „Je Seite“ ein Paar mit denselben Seiten wie der letzte Satz. */
export function newSetRows(exercise: SessionExercise): SetLog[] {
  if (!usesSides(exercise) || exercise.sets.length < 2) return [reopened(exercise.sets.at(-1))];
  const [first, second] = exercise.sets.slice(-2);
  return [reopened(first), reopened(second)];
}

export async function finishSession(session: WorkoutSession, durationSec: number): Promise<WorkoutSession> {
  return workoutRepository.saveSession({
    ...session,
    timers: undefined,
    completedAt: new Date().toISOString(),
    durationSec: Math.max(0, Math.round(durationSec)),
  });
}
