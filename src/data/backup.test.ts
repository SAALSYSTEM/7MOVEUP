import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import { BACKUP_SCHEMA_VERSION, parseBackup } from "./backup";
import { MoveUpDatabase } from "./local/db";
import { createLocalBackupService } from "./local/local-backup";
import { createLocalRepositories } from "./local/local-repositories";

function freshDb(name: string) {
  const db = new MoveUpDatabase(name);
  const repos = createLocalRepositories(db);
  return { db, repos, backup: createLocalBackupService(db, repos) };
}

describe("Export/Import", () => {
  it("lehnt kaputte und fremde Dateien verständlich ab", () => {
    expect(parseBackup("{nope")).toEqual({ ok: false, error: { kind: "invalid_json" } });
    expect(parseBackup(JSON.stringify({ app: "Other" }))).toEqual({ ok: false, error: { kind: "wrong_app" } });
    const newer = parseBackup(JSON.stringify({ app: "7MOVEUP", schemaVersion: BACKUP_SCHEMA_VERSION + 1 }));
    expect(newer.ok).toBe(false);
    const broken = parseBackup(JSON.stringify({ app: "7MOVEUP", schemaVersion: 1, exportedAt: "x", profile: {} }));
    expect(broken.ok === false && broken.error.kind).toBe("invalid_data");
  });

  it("legt beim ersten Start ein Profil ohne Namen an (Fallback ICH/ME)", async () => {
    const { repos } = freshDb("first-start");
    const profile = await repos.profiles.getCurrent();
    expect(profile.displayName).toBeUndefined();
    expect(await repos.profiles.getCurrent()).toEqual(profile);
  });

  it("Round-Trip: Export enthält nur das eigene Profil, Import ersetzt die lokalen Daten", async () => {
    const source = freshDb("source");
    await source.repos.profiles.update({ displayName: "Matthias" });
    await source.repos.exercises.saveNote("plank", { note: "Becken neutral" });
    await source.repos.exercises.saveCustom({
      id: "custom-1",
      builtIn: false,
      name: { de: "Eigene", en: "Own" },
      bodyRegions: ["core"],
      equipment: ["bodyweight"],
      trackingType: "duration",
    });
    const profile = await source.repos.profiles.getCurrent();
    await source.repos.plans.save({
      id: "plan-1",
      profileId: profile.id,
      name: "Tag 1",
      items: [{ id: "i1", exerciseId: "plank", sets: 3, durationSec: 40 }],
      weekdays: [1],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // fremdes Profil in derselben DB darf nicht im Export landen
    await source.db.plans.put({
      id: "foreign",
      profileId: "someone-else",
      name: "Fremd",
      items: [],
      weekdays: [],
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });

    const exported = await source.backup.exportCurrentProfile();
    expect(exported.plans.map((p) => p.id)).toEqual(["plan-1"]);
    expect(exported.profile.displayName).toBe("Matthias");

    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = freshDb("target");
    await target.repos.exercises.saveNote("dead-bug", { note: "wird überschrieben" });
    await target.backup.importReplacingCurrentProfile(parsed.backup);

    const targetProfile = await target.repos.profiles.getCurrent();
    expect(targetProfile.displayName).toBe("Matthias");
    expect((await target.repos.plans.getAll()).map((p) => p.name)).toEqual(["Tag 1"]);
    expect((await target.repos.exercises.getNote("plank"))?.note).toBe("Becken neutral");
    expect(await target.repos.exercises.getNote("dead-bug")).toBeUndefined();
    expect((await target.repos.exercises.getAll()).some((e) => e.id === "custom-1")).toBe(true);
  });

  it("letzte Leistung kommt aus der jüngsten abgeschlossenen Einheit", async () => {
    const { repos } = freshDb("last-performance");
    const profile = await repos.profiles.getCurrent();
    const base = { profileId: profile.id, planName: "Push", progressionStepKg: undefined };
    const entry = (weight: number) => ({
      id: `e-${weight}`,
      exerciseId: "db-flat-bench-press",
      name: { de: "Bank", en: "Bench" },
      trackingType: "weight_reps" as const,
      target: { sets: 2, repMin: 8, repMax: 10 },
      sets: [
        { weightPerDumbbellKg: weight, reps: 10, done: true },
        { weightPerDumbbellKg: weight, reps: 9, done: true },
      ],
    });
    await repos.workouts.saveSession({ ...base, id: "s1", date: "2026-09-28", startedAt: "2026-09-28T10:00:00.000Z", completedAt: "2026-09-28T11:00:00.000Z", exercises: [entry(16)] });
    await repos.workouts.saveSession({ ...base, id: "s2", date: "2026-10-01", startedAt: "2026-10-01T10:00:00.000Z", completedAt: "2026-10-01T11:00:00.000Z", exercises: [entry(18)] });
    // laufende Einheit zählt nicht
    await repos.workouts.saveSession({ ...base, id: "s3", date: "2026-10-04", startedAt: "2026-10-04T10:00:00.000Z", exercises: [entry(22)] });

    const last = await repos.workouts.getLastPerformance("db-flat-bench-press");
    expect(last?.sets.map((s) => s.weightPerDumbbellKg)).toEqual([18, 18]);
    expect(last?.sets.map((s) => s.reps)).toEqual([10, 9]);
    expect((await repos.workouts.getActiveSession())?.id).toBe("s3");
  });
});
