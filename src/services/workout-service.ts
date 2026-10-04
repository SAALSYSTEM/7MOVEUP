import { exerciseRepository, profileRepository, workoutRepository } from "@/data";
import type {
  Exercise,
  PerformanceSnapshot,
  SessionExercise,
  SetLog,
  WorkoutPlan,
  WorkoutPlanItem,
  WorkoutSession,
} from "@/domain/types";
import { createId } from "@/lib/id";
import { localDateKey } from "@/lib/dates";

function prefillSet(
  exercise: Exercise,
  item: WorkoutPlanItem,
  last: PerformanceSnapshot | undefined,
  index: number,
): SetLog {
  const lastSet = last?.sets[index] ?? last?.sets.at(-1);
  switch (exercise.trackingType) {
    case "weight_reps":
      return {
        weightPerDumbbellKg: lastSet?.weightPerDumbbellKg ?? item.weightStepsKg?.[0],
        reps: lastSet?.reps ?? item.repMin ?? item.repMax ?? exercise.defaultRepMin,
        done: false,
      };
    case "reps":
      return { reps: lastSet?.reps ?? item.repMin ?? item.repMax ?? exercise.defaultRepMin, done: false };
    case "duration":
      return {
        durationSec: item.durationSec ?? exercise.defaultDurationSec ?? 30,
        weightPerDumbbellKg: lastSet?.weightPerDumbbellKg ?? item.weightStepsKg?.[0],
        done: false,
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
  const sets = Array.from({ length: Math.max(1, item.sets) }, (_, i) => prefillSet(exercise, item, last, i));
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
      note: item.note,
    },
    sets,
  };
}

export async function startSessionFromPlan(plan: WorkoutPlan, date = new Date()): Promise<WorkoutSession> {
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
  return workoutRepository.saveSession(session);
}

export function emptySet(exercise: SessionExercise): SetLog {
  const previous = exercise.sets.at(-1);
  return { ...previous, done: false, completedAt: undefined };
}

export async function finishSession(session: WorkoutSession, durationSec: number): Promise<WorkoutSession> {
  return workoutRepository.saveSession({
    ...session,
    completedAt: new Date().toISOString(),
    durationSec: Math.max(0, Math.round(durationSec)),
  });
}
