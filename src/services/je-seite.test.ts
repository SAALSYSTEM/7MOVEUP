import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { workoutRepository } from "@/data";
import { BUILT_IN_EXERCISES, perSideDefaults, WORKOUT_TEMPLATES } from "@/data/seed";
import { plansFromTemplate } from "@/domain/schedule";
import type { SessionExercise, WorkoutPlan, WorkoutPlanItem } from "@/domain/types";
import { formatPerformance } from "@/lib/performance-format";
import { createTranslator } from "@/i18n";
import { newSetRows, startSessionFromPlan } from "@/services/workout-service";

function plan(items: WorkoutPlanItem[], id = "p1"): WorkoutPlan {
  return { id, profileId: "x", name: `Tag ${id}`, items, weekdays: [1], createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" };
}

const row = (exerciseId: string, patch: Partial<WorkoutPlanItem> = {}): WorkoutPlanItem => ({ id: `i-${exerciseId}`, exerciseId, sets: 3, ...patch });

/** Training beenden, damit die nächste Einheit die Startseite daraus ableitet */
async function finish(session: { id: string }, mutate?: (e: SessionExercise) => SessionExercise, doneAll = true) {
  const current = await workoutRepository.getSession(session.id);
  if (!current) throw new Error("Session fehlt");
  await workoutRepository.saveSession({
    ...current,
    completedAt: new Date(Date.parse(current.startedAt) + 3_600_000).toISOString(),
    exercises: current.exercises.map((e) => {
      const done = { ...e, sets: e.sets.map((s) => ({ ...s, done: doneAll })) };
      return mutate ? mutate(done) : done;
    }),
  });
}

afterEach(async () => {
  for (let open = await workoutRepository.getActiveSession(); open; open = await workoutRepository.getActiveSession()) {
    await workoutRepository.deleteSession(open.id);
  }
  for (const s of await workoutRepository.getCompletedSessions()) await workoutRepository.deleteSession(s.id);
});

describe("Training mit „Je Seite“", () => {
  it("3 Sätze je Seite ergeben 6 Zeilen mit expliziter Seite; Ziel bleibt bei 3 Sätzen", async () => {
    const { session } = await startSessionFromPlan(plan([row("one-arm-db-row", { perSide: true, repMin: 8, repMax: 10 })]));
    const entry = session.exercises[0];
    expect(entry.target).toMatchObject({ sets: 3, perSide: true });
    expect(entry.sets.map((s) => s.side)).toEqual(["left", "right", "left", "right", "left", "right"]);
    expect(entry.sets.every((s) => !s.done)).toBe(true);
  });

  it("die Startseite wechselt von Einheit zu Einheit (aus der Historie abgeleitet)", async () => {
    const item = row("one-arm-db-row", { perSide: true, repMin: 8, repMax: 10 });
    const first = await startSessionFromPlan(plan([item]));
    expect(first.session.exercises[0].sets[0].side).toBe("left");
    await finish(first.session);

    const second = await startSessionFromPlan(plan([item]));
    expect(second.session.exercises[0].sets.map((s) => s.side)).toEqual(["right", "left", "right", "left", "right", "left"]);
    await finish(second.session);

    const third = await startSessionFromPlan(plan([item]));
    expect(third.session.exercises[0].sets[0].side).toBe("left");
  });

  it("Startseite zählt die erste GEPLANTE Zeile, auch wenn dort nichts erledigt wurde", async () => {
    const item = row("one-arm-db-row", { perSide: true, sets: 1, repMin: 8, repMax: 10 });
    const first = await startSessionFromPlan(plan([item]));
    // nur die rechte Seite erledigt – gestartet war links
    await finish(first.session, (e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: s.side === "right" })) }), false);
    const second = await startSessionFromPlan(plan([item]));
    expect(second.session.exercises[0].sets[0].side).toBe("right");
  });

  it("Vorbelegung folgt (Satz, Seite) – auch wenn diesmal die andere Seite beginnt", async () => {
    const item = row("one-arm-db-row", { perSide: true, sets: 2, repMin: 8, repMax: 12 });
    const first = await startSessionFromPlan(plan([item]));
    await finish(first.session, (e) => ({
      ...e,
      sets: e.sets.map((s) => ({ ...s, reps: s.side === "left" ? 12 : 9, weightPerDumbbellKg: s.side === "left" ? 16 : 14 })),
    }));
    const second = await startSessionFromPlan(plan([item]));
    const sets = second.session.exercises[0].sets;
    expect(sets.map((s) => s.side)).toEqual(["right", "left", "right", "left"]);
    expect(sets.map((s) => s.reps)).toEqual([9, 12, 9, 12]);
    expect(sets.map((s) => s.weightPerDumbbellKg)).toEqual([14, 16, 14, 16]);
  });

  it("ältere Einheit ohne Seiten: beide Seiten bekommen den Wert des gleichen Satzes", async () => {
    const plain = row("one-arm-db-row", { repMin: 8, repMax: 12, sets: 2 });
    const first = await startSessionFromPlan(plan([plain]));
    await finish(first.session, (e) => ({ ...e, sets: e.sets.map((s, i) => ({ ...s, reps: i === 0 ? 11 : 7 })) }));
    const second = await startSessionFromPlan(plan([{ ...plain, perSide: true }]));
    expect(second.session.exercises[0].sets.map((s) => s.reps)).toEqual([11, 11, 7, 7]);
    expect(second.session.exercises[0].sets[0].side).toBe("left"); // keine Seiteninformation → LINKS
  });

  it("bestehende Planübung ohne perSide bleibt ohne Seiten – egal welche Übung (keine Ableitung aus ID/Name)", async () => {
    for (const id of ["side-plank", "one-arm-db-row", "bulgarian-split-squat", "clamshell"]) {
      const { session } = await startSessionFromPlan(plan([row(id, { durationSec: 30, repMin: 8, repMax: 10 })], `old-${id}`));
      const entry = session.exercises[0];
      expect(entry.target.perSide).toBeUndefined();
      expect(entry.sets).toHaveLength(3);
      expect(entry.sets.some((s) => s.side)).toBe(false);
      await workoutRepository.deleteSession(session.id);
    }
  });

  it("Cardio kennt keine Seiten, auch wenn perSide gesetzt ist", async () => {
    const { session } = await startSessionFromPlan(plan([row("ergometer", { sets: 1, durationSec: 1800, perSide: true })]));
    expect(session.exercises[0].target.perSide).toBeUndefined();
    expect(session.exercises[0].sets).toHaveLength(1);
  });

  it("Wechselpause: nur bei Zeitübungen, Vorgabe 5 s, 0 bleibt 0", async () => {
    const run = async (switchSec: number | undefined) => {
      const { session } = await startSessionFromPlan(plan([row("side-plank", { perSide: true, durationSec: 30, switchSec })]));
      const target = session.exercises[0].target;
      await workoutRepository.deleteSession(session.id);
      return target.switchSec;
    };
    expect(await run(undefined)).toBe(5);
    expect(await run(0)).toBe(0);
    expect(await run(8)).toBe(8);
    const reps = await startSessionFromPlan(plan([row("one-arm-db-row", { perSide: true, repMin: 8, repMax: 10, switchSec: 5 })], "reps"));
    expect(reps.session.exercises[0].target.switchSec).toBeUndefined();
  });

  it("„Satz hinzufügen“ legt bei Je Seite ein Paar mit den Seiten des letzten Satzes an", async () => {
    const first = await startSessionFromPlan(plan([row("one-arm-db-row", { perSide: true, sets: 1, repMin: 8, repMax: 10 })]));
    await finish(first.session);
    const second = await startSessionFromPlan(plan([row("one-arm-db-row", { perSide: true, sets: 1, repMin: 8, repMax: 10 })]));
    const entry = second.session.exercises[0];
    const rows = newSetRows({ ...entry, sets: entry.sets.map((s) => ({ ...s, done: true, completedAt: "x" })) });
    expect(rows.map((s) => s.side)).toEqual(["right", "left"]);
    expect(rows.every((s) => !s.done && !s.completedAt)).toBe(true);
  });
});

describe("„Letztes Mal“ mit Seiten", () => {
  const t = createTranslator("de");
  it("zeigt je eine Zeile pro Seite", () => {
    const sets = [
      { side: "left" as const, reps: 10, weightPerDumbbellKg: 16, done: true },
      { side: "right" as const, reps: 9, weightPerDumbbellKg: 16, done: true },
      { side: "left" as const, reps: 9, weightPerDumbbellKg: 16, done: true },
      { side: "right" as const, reps: 8, weightPerDumbbellKg: 16, done: true },
    ];
    const text = formatPerformance("weight_reps", sets, { equipment: ["dumbbells"] }, t, "de");
    expect(text.headline).toBe("16 kg je Hantel");
    expect(text.detail).toBe("Links 10 / 9\nRechts 9 / 8");
  });

  it("Einheiten ohne Seiten sehen aus wie bisher", () => {
    const text = formatPerformance("reps", [{ reps: 10, done: true }, { reps: 9, done: true }], undefined, t, "de");
    expect(text.detail).toBe("10 / 9 Wdh.");
  });
});

describe("Defaults nur beim bewussten Neuanlegen", () => {
  const byId = (id: string) => BUILT_IN_EXERCISES.find((e) => e.id === id);

  it("sieben eindeutig einseitige Übungen starten mit Je Seite; Zeitübungen mit 5 s Wechsel", () => {
    const ids = ["one-arm-db-row", "bulgarian-split-squat", "single-leg-glute-bridge", "clamshell", "side-plank", "single-leg-stand", "suitcase-carry"];
    for (const id of ids) expect(perSideDefaults(byId(id)), id).toMatchObject({ perSide: true });
    expect(perSideDefaults(byId("side-plank"))).toEqual({ perSide: true, switchSec: 5 });
    expect(perSideDefaults(byId("one-arm-db-row"))).toEqual({ perSide: true });
  });

  it("mehrdeutige und beidseitige Übungen, eigene Übungen und Cardio bekommen keinen Default", () => {
    for (const id of ["low-step-up", "reverse-lunge", "forward-lunge", "calf-raise", "db-rdl", "dead-bug", "farmer-carry", "plank", "ergometer"]) {
      expect(perSideDefaults(byId(id)), id).toEqual({});
    }
    expect(perSideDefaults({ id: "side-plank", builtIn: false, trackingType: "duration" })).toEqual({});
    expect(perSideDefaults(undefined)).toEqual({});
  });

  it("übernommene Vorlagen tragen den Default – genau für diese Übungen", () => {
    const flagged: string[] = [];
    for (const template of WORKOUT_TEMPLATES) {
      for (const p of plansFromTemplate(template, "de", "profile")) {
        for (const item of p.items) {
          if (item.perSide) flagged.push(item.exerciseId);
          if (item.perSide && byId(item.exerciseId)?.trackingType === "duration") expect(item.switchSec).toBe(5);
          else expect(item.switchSec).toBeUndefined();
        }
      }
    }
    expect(flagged).toHaveLength(11);
    expect(new Set(flagged)).toEqual(new Set(["one-arm-db-row", "bulgarian-split-squat", "single-leg-glute-bridge", "clamshell", "side-plank", "suitcase-carry"]));
  });

  it("das Starten eines Trainings liest die Liste nie: bestehender Plan mit denselben Übungen bleibt ohne Seiten", async () => {
    const template = WORKOUT_TEMPLATES.find((tpl) => tpl.id === "template-4day-strength-core");
    expect(template).toBeDefined();
    const [adopted] = plansFromTemplate(template!, "de", "profile").filter((p) => p.items.some((i) => i.exerciseId === "side-plank"));
    // „bestehender“ Plan: gleiche Übungen, aber ohne perSide-Feld (wie vor 1.7.3 gespeichert)
    const legacy = { ...adopted, items: adopted.items.map(({ perSide: _p, switchSec: _s, ...rest }) => rest) };
    const { session } = await startSessionFromPlan(legacy);
    expect(session.exercises.every((e) => !e.target.perSide && e.sets.every((s) => !s.side))).toBe(true);
  });
});
