import { addDays, isBefore, startOfDay } from "date-fns";

import type { Exercise, Language, Weekday, WorkoutPlan, WorkoutSession } from "@/domain/types";
import type { WorkoutTemplate } from "@/data/seed";
import { createId } from "@/lib/id";
import { isoWeekday, localDateKey, parseDateKey, weekDays } from "@/lib/dates";

export type PlanKind = "strength" | "cardio";

export function planKind(plan: WorkoutPlan, exercisesById: Map<string, Exercise>): PlanKind {
  if (plan.items.length === 0) return "strength";
  const allCardio = plan.items.every((item) => exercisesById.get(item.exerciseId)?.trackingType === "cardio");
  return allCardio ? "cardio" : "strength";
}

/** Planung gilt ab dem Tag, an dem der Plan angelegt wurde – nicht rückwirkend. */
export function isPlannedOn(plan: WorkoutPlan, date: Date): boolean {
  if (!plan.weekdays.includes(isoWeekday(date))) return false;
  const created = startOfDay(new Date(plan.createdAt));
  return !isBefore(startOfDay(date), created);
}

export function plansForDate(plans: WorkoutPlan[], date: Date): WorkoutPlan[] {
  return plans.filter((plan) => isPlannedOn(plan, date));
}

export function sessionsForDate(sessions: WorkoutSession[], date: Date): WorkoutSession[] {
  const key = localDateKey(date);
  return sessions.filter((s) => s.date === key);
}

export type DayStatus = {
  date: Date;
  planned: WorkoutPlan[];
  completed: WorkoutSession[];
  kind: "done" | "strength" | "cardio" | "rest";
};

export function dayStatus(
  date: Date,
  plans: WorkoutPlan[],
  completed: WorkoutSession[],
  exercisesById: Map<string, Exercise>,
): DayStatus {
  const planned = plansForDate(plans, date);
  const done = sessionsForDate(completed, date);
  let kind: DayStatus["kind"] = "rest";
  if (done.length > 0) kind = "done";
  else if (planned.some((p) => planKind(p, exercisesById) === "strength")) kind = "strength";
  else if (planned.length > 0) kind = "cardio";
  return { date, planned, completed: done, kind };
}

/**
 * Fortschritt der heute geplanten Trainings für den Hinweis auf der Startseite:
 * "done" = alle geplanten erledigt (oder an einem freien Tag trainiert), "partial" = x von y.
 */
export function todayProgress(
  plans: WorkoutPlan[],
  completed: WorkoutSession[],
  today = new Date(),
): { state: "none" | "partial" | "done"; done: number; total: number } {
  const planned = plansForDate(plans, today);
  const doneIds = new Set(sessionsForDate(completed, today).map((s) => s.planId));
  const total = planned.length;
  const done = planned.filter((plan) => doneIds.has(plan.id)).length;
  if (total === 0) return { state: doneIds.size > 0 ? "done" : "none", done: 0, total: 0 };
  if (done === total) return { state: "done", done, total };
  return { state: done > 0 ? "partial" : "none", done, total };
}

/** Geplante Pläne für heute, die heute noch nicht abgeschlossen wurden */
export function openPlansToday(plans: WorkoutPlan[], completed: WorkoutSession[], today = new Date()): WorkoutPlan[] {
  const doneToday = new Set(sessionsForDate(completed, today).map((s) => s.planId));
  return plansForDate(plans, today).filter((plan) => !doneToday.has(plan.id));
}

export function nextPlanned(
  plans: WorkoutPlan[],
  completed: WorkoutSession[],
  from = new Date(),
): { date: Date; plan: WorkoutPlan } | undefined {
  const openToday = openPlansToday(plans, completed, from);
  if (openToday.length > 0) return { date: from, plan: openToday[0] };
  for (let i = 1; i <= 14; i += 1) {
    const date = addDays(from, i);
    const planned = plansForDate(plans, date);
    if (planned.length > 0) return { date, plan: planned[0] };
  }
  return undefined;
}

export type WeekSummary = {
  completedCount: number;
  plannedCount: number;
  minutes: number;
};

export function weekSummary(plans: WorkoutPlan[], completed: WorkoutSession[], today = new Date()): WeekSummary {
  const days = weekDays(today);
  const keys = new Set(days.map((d) => localDateKey(d)));
  const thisWeek = completed.filter((s) => keys.has(s.date));
  const plannedCount = days.reduce((acc, day) => acc + plansForDate(plans, day).length, 0);
  const minutes = Math.round(thisWeek.reduce((acc, s) => acc + (s.durationSec ?? 0), 0) / 60);
  return { completedCount: thisWeek.length, plannedCount, minutes };
}

export function sessionsThisWeek(completed: WorkoutSession[], today = new Date()): WorkoutSession[] {
  const keys = new Set(weekDays(today).map((d) => localDateKey(d)));
  return completed.filter((s) => keys.has(s.date));
}

export function sessionDate(session: WorkoutSession): Date {
  return parseDateKey(session.date);
}

/** Erzeugt aus einer Vorlage editierbare Pläne (einen pro Trainingstag). */
export function plansFromTemplate(template: WorkoutTemplate, language: Language, profileId: string): WorkoutPlan[] {
  const now = Date.now();
  const groupName = template.name[language];
  return template.days.map((day, index) => {
    // +index ms hält die Reihenfolge der Trainingstage stabil (Sortierung nach createdAt)
    const timestamp = new Date(now + index).toISOString();
    const notes = [day.notes?.[language], template.planNotes?.[language]].filter(Boolean).join("\n");
    return {
      id: createId(),
      profileId,
      name: day.name[language],
      group: groupName,
      templateId: template.id,
      weekdays: day.weekday ? [day.weekday as Weekday] : [],
      notes: notes || undefined,
      progressionStepKg: template.progressionStepKg,
      items: day.items.map((item) => ({
        id: createId(),
        exerciseId: item.exerciseId,
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        durationSec: item.durationSec,
        restSec: item.restSec,
        weightStepsKg: item.weightStepsKg,
        note: item.note?.[language],
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}
