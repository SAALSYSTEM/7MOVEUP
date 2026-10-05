import { describe, expect, it } from "vitest";

import { isResumableSession, restoreTimers } from "./active-session";
import type { SessionExercise, WorkoutSession } from "./types";

const NOW = new Date("2026-10-05T08:00:00+02:00").getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const cardio: SessionExercise = {
  id: "e-cardio",
  exerciseId: "ergometer",
  name: { de: "Ergometer", en: "Stationary Bike" },
  trackingType: "cardio",
  target: { sets: 1, durationSec: 35 * 60 },
  sets: [{ durationSec: 35 * 60, done: false }],
};

const session = (patch: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: "s1",
  profileId: "p1",
  planName: "Montag – Ergometer locker",
  date: "2026-10-05",
  startedAt: iso(-40 * 60_000),
  exercises: [cardio],
  ...patch,
});

describe("Offenes Training nach Neustart", () => {
  it("springt in ein Training, das vor kurzem begann", () => {
    expect(isResumableSession(session(), new Date(NOW))).toBe(true);
  });

  it("nicht bei abgeschlossenen oder alten Trainings", () => {
    expect(isResumableSession(session({ completedAt: iso(-60_000) }), new Date(NOW))).toBe(false);
    expect(isResumableSession(session({ startedAt: iso(-7 * 3600_000) }), new Date(NOW))).toBe(false);
    expect(isResumableSession(undefined, new Date(NOW))).toBe(false);
  });
});

describe("Gespeicherte Timer", () => {
  it("laufender Cardio-Timer läuft mit Restzeit weiter", () => {
    const s = session({ timers: { set: { entryId: "e-cardio", setIndex: 0, durationSec: 2100, status: "running", endAt: iso(5 * 60_000) } } });
    const r = restoreTimers(s, NOW);
    expect(r.setTimer).toEqual({ exerciseIndex: 0, setIndex: 0, resume: { status: "running", endAt: NOW + 5 * 60_000 } });
    expect(r.changed).toBe(false);
    expect(r.completedWhileAway).toBeUndefined();
  });

  it("abgelaufener Timer: Satz mit voller Zeit abgehakt, Timer entfernt", () => {
    const s = session({ timers: { set: { entryId: "e-cardio", setIndex: 0, durationSec: 2100, status: "running", endAt: iso(-2 * 60_000) } } });
    const r = restoreTimers(s, NOW);
    expect(r.changed).toBe(true);
    expect(r.completedWhileAway).toEqual({ exerciseIndex: 0, setIndex: 0 });
    expect(r.session.exercises[0].sets[0]).toMatchObject({ done: true, durationSec: 2100, completedAt: iso(-2 * 60_000) });
    expect(r.session.timers).toBeUndefined();
    expect(r.setTimer).toBeUndefined();
  });

  it("pausierter Timer öffnet wieder pausiert", () => {
    const s = session({ timers: { set: { entryId: "e-cardio", setIndex: 0, durationSec: 2100, status: "paused", remainingMs: 90_000 } } });
    expect(restoreTimers(s, NOW).setTimer?.resume).toEqual({ status: "paused", remainingMs: 90_000 });
  });

  it("Pausen-Timer: läuft weiter oder wird verworfen", () => {
    const running = restoreTimers(session({ timers: { rest: { endAt: iso(30_000), seconds: 90, label: "Plank" } } }), NOW);
    expect(running.rest).toEqual({ endAt: NOW + 30_000, seconds: 90, label: "Plank" });
    const over = restoreTimers(session({ timers: { rest: { endAt: iso(-1000), seconds: 90, label: "Plank" } } }), NOW);
    expect(over.rest).toBeUndefined();
    expect(over.session.timers).toBeUndefined();
    expect(over.changed).toBe(true);
  });

  it("verwirft Timer für bereits abgehakte oder unbekannte Sätze", () => {
    const done = session({
      exercises: [{ ...cardio, sets: [{ durationSec: 1800, done: true }] }],
      timers: { set: { entryId: "e-cardio", setIndex: 0, durationSec: 2100, status: "running", endAt: iso(-1000) } },
    });
    const r = restoreTimers(done, NOW);
    expect(r.session.exercises[0].sets[0].durationSec).toBe(1800);
    expect(r.session.timers).toBeUndefined();
    const unknown = restoreTimers(session({ timers: { set: { entryId: "x", setIndex: 0, durationSec: 60, status: "running", endAt: iso(1000) } } }), NOW);
    expect(unknown.setTimer).toBeUndefined();
  });
});
