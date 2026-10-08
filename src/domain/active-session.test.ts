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

describe("Gespeicherter „Je Seite“-Timer", () => {
  /** Side Plank: 2 Sätze je Seite, 30 s, Wechsel 5 s, Pause 45 s → Folge 110 s */
  const plank: SessionExercise = {
    id: "e-plank",
    exerciseId: "side-plank",
    name: { de: "Side Plank", en: "Side Plank" },
    trackingType: "duration",
    target: { sets: 2, durationSec: 30, restSec: 45, perSide: true, switchSec: 5 },
    sets: [
      { side: "left", durationSec: 30, done: false },
      { side: "right", durationSec: 30, done: false },
      { side: "left", durationSec: 30, done: false },
      { side: "right", durationSec: 30, done: false },
    ],
  };
  const timer = (patch: Record<string, unknown>) => ({
    entryId: "e-plank",
    setIndex: 0,
    durationSec: 110,
    sequence: { rows: [0, 1], restSec: 45 },
    ...patch,
  });
  const sessionWith = (set: object, entry: SessionExercise = plank) =>
    session({ exercises: [entry], timers: { set: set as never } });
  const done = (r: ReturnType<typeof restoreTimers>) => r.session.exercises[0].sets.map((s) => s.done);

  it("läuft in der ersten Seite: weiter mit Restzeit, nichts abgehakt", () => {
    // gestartet vor 10 s → Ende in 100 s
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(100_000) })), NOW);
    expect(r.setTimer).toEqual({
      exerciseIndex: 0,
      setIndex: 0,
      resume: { status: "running", endAt: NOW + 100_000 },
      sequence: { rows: [0, 1], restSec: 45 },
    });
    expect(done(r)).toEqual([false, false, false, false]);
    expect(r.changed).toBe(false);
  });

  it("läuft in der zweiten Seite: die erste ist abgehakt, der Satz noch nicht vollständig", () => {
    // gestartet vor 50 s (Wechsel vorbei, rechts läuft seit 15 s)
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(60_000) })), NOW);
    expect(done(r)).toEqual([true, false, false, false]);
    expect(r.session.exercises[0].sets[0]).toMatchObject({ durationSec: 30, completedAt: iso(-50_000 + 30_000) });
    expect(r.setTimer?.resume).toEqual({ status: "running", endAt: NOW + 60_000 });
    expect(r.changed).toBe(true);
  });

  it("läuft in der Satzpause: beide Seiten abgehakt, die Pause läuft weiter", () => {
    // gestartet vor 80 s → Pause seit 15 s, noch 30 s
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(30_000) })), NOW);
    expect(done(r)).toEqual([true, true, false, false]);
    expect(r.setTimer?.resume).toEqual({ status: "running", endAt: NOW + 30_000 });
    expect(r.completedWhileAway).toBeUndefined();
  });

  it("Folge war schon in der Satzpause abgehakt: nichts ändert sich", () => {
    const already = { ...plank, sets: plank.sets.map((s, i) => (i < 2 ? { ...s, done: true } : s)) };
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(30_000) }), already), NOW);
    expect(r.session.exercises[0]).toBe(already);
    expect(r.changed).toBe(false);
    expect(r.setTimer?.resume.status).toBe("running");
  });

  it("alles abgelaufen, während die App weg war: beide Seiten mit voller Zeit abgehakt, Timer weg", () => {
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(-20_000) })), NOW);
    expect(done(r)).toEqual([true, true, false, false]);
    expect(r.session.exercises[0].sets.slice(0, 2).map((s) => s.durationSec)).toEqual([30, 30]);
    expect(r.completedWhileAway).toEqual({ exerciseIndex: 0, setIndex: 0 });
    expect(r.setTimer).toBeUndefined();
    expect(r.session.timers).toBeUndefined();
  });

  it("nur Satzpause abgelaufen, Seiten schon abgehakt: Timer verworfen, kein Hinweis", () => {
    const already = { ...plank, sets: plank.sets.map((s, i) => (i < 2 ? { ...s, done: true } : s)) };
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(-1000) }), already), NOW);
    expect(r.completedWhileAway).toBeUndefined();
    expect(r.session.timers).toBeUndefined();
    expect(r.changed).toBe(true);
  });

  it("pausiert in der zweiten Seite: erste abgehakt, öffnet wieder pausiert", () => {
    // 110 s Gesamt, noch 50 s übrig → 60 s gelaufen (rechts seit 25 s)
    const r = restoreTimers(sessionWith(timer({ status: "paused", remainingMs: 50_000 })), NOW);
    expect(done(r)).toEqual([true, false, false, false]);
    expect(r.setTimer?.resume).toEqual({ status: "paused", remainingMs: 50_000 });
  });

  it("nur die offene Seite (links war schon erledigt): Folge aus den gespeicherten Zeilen", () => {
    const leftDone = { ...plank, sets: plank.sets.map((s, i) => (i === 0 ? { ...s, done: true } : s)) };
    // Folge RECHTS 30 s + Pause 45 s = 75 s; gestartet vor 40 s → Satzpause läuft
    const stored = timer({ setIndex: 1, durationSec: 75, sequence: { rows: [1], restSec: 45 }, status: "running", endAt: iso(35_000) });
    const r = restoreTimers(sessionWith(stored, leftDone), NOW);
    expect(done(r)).toEqual([true, true, false, false]);
    expect(r.setTimer?.sequence).toEqual({ rows: [1], restSec: 45 });
  });

  it("ungültige Folge (unbekannte Zeile) wird verworfen", () => {
    const r = restoreTimers(
      sessionWith(timer({ status: "running", endAt: iso(5000), sequence: { rows: [8, 9], restSec: 45 } })),
      NOW,
    );
    expect(r.setTimer).toBeUndefined();
    expect(r.session.timers).toBeUndefined();
    expect(done(r)).toEqual([false, false, false, false]);
  });

  it("unbekannte Übung: Timer verworfen", () => {
    const r = restoreTimers(sessionWith(timer({ status: "running", endAt: iso(5000), entryId: "weg" })), NOW);
    expect(r.setTimer).toBeUndefined();
  });
});
