import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { workoutRepository } from "@/data";
import type { WorkoutPlan, WorkoutSession } from "@/domain/types";
import { startSessionFromPlan } from "@/services/workout-service";

import { MoveUpDatabase } from "./local/db";
import { createLocalRepositories } from "./local/local-repositories";

function session(id: string, planId: string, startedAt = "2026-11-09T07:00:00.000Z"): WorkoutSession {
  return { id, profileId: "x", planId, planName: `Plan ${planId}`, date: "2026-11-09", startedAt, exercises: [] };
}

function plan(id: string): WorkoutPlan {
  return {
    id,
    profileId: "x",
    name: `Tag ${id}`,
    items: [{ id: `${id}-item`, exerciseId: "plank", sets: 2, durationSec: 30 }],
    weekdays: [1],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("Training starten – nie eine zweite offene Session (Repository)", () => {
  const fresh = (name: string) => {
    const db = new MoveUpDatabase(name);
    return { db, workouts: createLocalRepositories(db).workouts };
  };

  it("legt ein Training an, wenn keines offen ist", async () => {
    const { workouts } = fresh("start-1");
    const result = await workouts.startSession(session("a", "p1"));
    expect(result.created).toBe(true);
    expect((await workouts.getActiveSession())?.id).toBe("a");
  });

  it("gibt das offene Training zurück, statt ein zweites anzulegen", async () => {
    const { db, workouts } = fresh("start-2");
    await workouts.startSession(session("a", "p1"));
    const second = await workouts.startSession(session("b", "p2", "2026-11-09T08:00:00.000Z"));
    expect(second.created).toBe(false);
    expect(second.session.id).toBe("a");
    expect(await db.sessions.count()).toBe(1);
  });

  it("gleichzeitiges Starten (Doppeltippen, zwei Fenster) erzeugt genau ein offenes Training", async () => {
    const { db, workouts } = fresh("start-3");
    const results = await Promise.all(
      ["a", "b", "c", "d", "e"].map((id, i) => workouts.startSession(session(id, "p1", `2026-11-09T07:0${i}:00.000Z`))),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.session.id)).size).toBe(1);
    expect(await db.sessions.count()).toBe(1);
  });

  it("abgeschlossene oder verworfene Trainings blockieren nicht", async () => {
    const { workouts } = fresh("start-4");
    const first = await workouts.startSession(session("a", "p1"));
    await workouts.saveSession({ ...first.session, completedAt: "2026-11-09T08:00:00.000Z" });
    const second = await workouts.startSession(session("b", "p1", "2026-11-09T09:00:00.000Z"));
    expect(second.created).toBe(true);
    await workouts.deleteSession("b");
    const third = await workouts.startSession(session("c", "p2", "2026-11-09T10:00:00.000Z"));
    expect(third.created).toBe(true);
    expect((await workouts.getActiveSession())?.id).toBe("c");
  });
});

describe("startSessionFromPlan – zentrale Startlogik", () => {
  afterEach(async () => {
    for (let open = await workoutRepository.getActiveSession(); open; open = await workoutRepository.getActiveSession()) {
      await workoutRepository.deleteSession(open.id);
    }
  });

  it("startet das Training, wenn keines läuft", async () => {
    const result = await startSessionFromPlan(plan("p1"));
    expect(result.created).toBe(true);
    expect(result.session.planId).toBe("p1");
    expect(result.session.exercises).toHaveLength(1);
  });

  it("läuft dasselbe Training schon, wird es fortgesetzt", async () => {
    const first = await startSessionFromPlan(plan("p1"));
    const again = await startSessionFromPlan(plan("p1"));
    expect(again.created).toBe(false);
    expect(again.session.id).toBe(first.session.id);
  });

  it("läuft ein anderes Training, wird dieses geöffnet und keines gestartet", async () => {
    const first = await startSessionFromPlan(plan("p1"));
    const other = await startSessionFromPlan(plan("p2"));
    expect(other.created).toBe(false);
    expect(other.session.id).toBe(first.session.id);
    expect(other.session.planId).toBe("p1");
  });

  it("Doppeltippen: gleichzeitige Starts ergeben genau eine offene Session", async () => {
    const results = await Promise.all([startSessionFromPlan(plan("p1")), startSessionFromPlan(plan("p1")), startSessionFromPlan(plan("p2"))]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.session.id)).size).toBe(1);
    const completed = await workoutRepository.getCompletedSessions();
    expect(completed).toHaveLength(0);
  });
});
