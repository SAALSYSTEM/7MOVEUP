import { describe, expect, it } from "vitest";

import { todayProgress } from "./schedule";
import type { WorkoutPlan, WorkoutSession } from "./types";

// Montag, 5. Oktober 2026
const MONDAY = new Date("2026-10-05T09:00:00+02:00");

const plan = (id: string, weekdays: WorkoutPlan["weekdays"]): WorkoutPlan => ({
  id,
  profileId: "p1",
  name: id,
  items: [],
  weekdays,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
});

const done = (planId: string | undefined): WorkoutSession => ({
  id: `s-${planId}`,
  profileId: "p1",
  planId,
  planName: String(planId),
  date: "2026-10-05",
  startedAt: "2026-10-05T06:00:00.000Z",
  completedAt: "2026-10-05T06:40:00.000Z",
  exercises: [],
});

describe("Heute geplant – Fortschritt", () => {
  const plans = [plan("push", [1]), plan("cardio", [1]), plan("legs", [2])];

  it("x von y, solange nicht alles erledigt ist", () => {
    expect(todayProgress(plans, [done("cardio")], MONDAY)).toEqual({ state: "partial", done: 1, total: 2 });
  });

  it("Erledigt erst, wenn alle geplanten Trainings fertig sind", () => {
    expect(todayProgress(plans, [done("cardio"), done("push")], MONDAY).state).toBe("done");
  });

  it("nichts erledigt → kein Hinweis, auch nicht bei ungeplantem Training", () => {
    expect(todayProgress(plans, [], MONDAY).state).toBe("none");
    expect(todayProgress(plans, [done("legs")], MONDAY).state).toBe("none");
  });

  it("freier Tag mit Training → Erledigt", () => {
    expect(todayProgress([plan("legs", [2])], [done("legs")], MONDAY).state).toBe("done");
  });
});
