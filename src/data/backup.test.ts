import "fake-indexeddb/auto";

import Dexie from "dexie";
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

describe("Körperwerte: Datenbank-Version 2 und Backup-Format 2", () => {
  it("bestehende Datenbank (Version 1) wird ohne Datenverlust auf Version 2 gehoben", async () => {
    const name = "upgrade-v1";
    const v1 = new Dexie(name);
    v1.version(1).stores({
      meta: "key",
      profiles: "id",
      settings: "profileId",
      customExercises: "id, profileId",
      exerciseNotes: "[profileId+exerciseId], profileId",
      plans: "id, profileId",
      sessions: "id, profileId, [profileId+startedAt]",
    });
    await v1.open();
    await v1.table("meta").put({ key: "currentProfileId", value: "p-old" });
    await v1.table("profiles").put({ id: "p-old", displayName: "Alt", language: "de", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
    await v1.table("settings").put({ profileId: "p-old", soundEnabled: false, hapticsEnabled: true, updatedAt: "2026-09-01T00:00:00.000Z" });
    await v1.table("plans").put({ id: "plan-old", profileId: "p-old", name: "Tag 1 – Push", items: [], weekdays: [1], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
    await v1.table("sessions").put({ id: "s-old", profileId: "p-old", planName: "Tag 1 – Push", date: "2026-10-01", startedAt: "2026-10-01T06:00:00.000Z", completedAt: "2026-10-01T06:40:00.000Z", durationSec: 2400, exercises: [] });
    v1.close();

    const { repos } = freshDb(name);
    expect((await repos.profiles.getCurrent()).displayName).toBe("Alt");
    expect((await repos.settings.get()).soundEnabled).toBe(false);
    expect((await repos.settings.get()).unitSystem).toBeUndefined(); // → metrisch
    expect((await repos.plans.getAll()).map((p) => p.id)).toEqual(["plan-old"]);
    expect((await repos.workouts.getCompletedSessions()).map((s) => s.id)).toEqual(["s-old"]);
    expect(await repos.body.getMeasurements()).toEqual([]);
    expect((await repos.body.getSettings()).metrics.length).toBeGreaterThan(0);
  });

  it("ein Backup aus Version 1.2.0 (Format 1) bleibt importierbar", async () => {
    const v1File = {
      app: "7MOVEUP",
      schemaVersion: 1,
      exportedAt: "2026-10-05T16:00:00.000Z",
      profile: { id: "x", displayName: "Matthias", language: "de", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
      customExercises: [],
      exerciseNotes: [],
      plans: [{ id: "p1", name: "Tag 1", items: [], weekdays: [1, 4], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }],
      sessions: [{ id: "s1", planName: "Tag 1", date: "2026-10-01", startedAt: "2026-10-01T06:00:00.000Z", completedAt: "2026-10-01T06:40:00.000Z", exercises: [] }],
      settings: { soundEnabled: true, hapticsEnabled: false },
    };
    const parsed = parseBackup(JSON.stringify(v1File));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.measurements).toEqual([]);
    const { repos, backup } = freshDb("import-v1");
    await repos.body.saveMeasurement({ date: "2026-10-02", values: { weight: 70 } });
    await backup.importReplacingCurrentProfile(parsed.backup);
    expect((await repos.plans.getAll()).map((p) => p.name)).toEqual(["Tag 1"]);
    expect((await repos.settings.get()).hapticsEnabled).toBe(false);
    expect(await repos.body.getMeasurements()).toEqual([]); // ersetzen = auch Körperwerte
    expect((await backup.getBackupInfo()).lastBackupAt).toBe("2026-10-05T16:00:00.000Z");
  });

  it("Round-Trip Format 2: Messungen, eigene Messwerte, Messtage, Einheiten", async () => {
    const source = freshDb("body-source");
    await source.repos.settings.update({ unitSystem: "imperial" });
    const settings = await source.repos.body.getSettings();
    await source.repos.body.saveSettings({
      measureWeekdays: [7],
      custom: [{ key: "custom-neck", name: "Hals", unit: "cm", step: 0.5, createdAt: "2026-10-01T00:00:00.000Z" }],
      metrics: [{ key: "waist", enabled: true }, ...settings.metrics.filter((x) => x.key !== "waist")],
    });
    const saved = await source.repos.body.saveMeasurement({ date: "2026-10-04", time: "07:05", values: { weight: 75.0243, "custom-neck": 38.5 } });
    // Aktualisieren behält ID und Erstellzeit
    const updated = await source.repos.body.saveMeasurement({ id: saved.id, date: "2026-10-04", time: "07:05", values: { ...saved.values, body_fat: 22.1 } });
    expect(updated.id).toBe(saved.id);
    expect(updated.createdAt).toBe(saved.createdAt);

    const exported = await source.backup.exportCurrentProfile();
    expect(exported.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = freshDb("body-target");
    await target.backup.importReplacingCurrentProfile(parsed.backup);
    const measurements = await target.repos.body.getMeasurements();
    expect(measurements).toHaveLength(1);
    expect(measurements[0].values).toEqual({ weight: 75.0243, "custom-neck": 38.5, body_fat: 22.1 });
    expect(measurements[0].time).toBe("07:05");
    const body = await target.repos.body.getSettings();
    expect(body.measureWeekdays).toEqual([7]);
    expect(body.metrics[0]).toEqual({ key: "waist", enabled: true });
    expect(body.custom.map((c) => c.name)).toEqual(["Hals"]);
    expect((await target.repos.settings.get()).unitSystem).toBe("imperial");
  });

  it("Round-Trip: Messpläne und Zeitfenster der Messungen", async () => {
    const source = freshDb("plans-source");
    const plan = { id: "bp", name: "Blutdruck", metricKeys: ["bp_sys", "bp_dia"], weekdays: [7] as (1 | 2 | 3 | 4 | 5 | 6 | 7)[], perDay: 3 };
    const saved = await source.repos.body.saveSettings({ plans: [plan] });
    expect(saved.measureWeekdays).toEqual([7]);
    await source.repos.body.saveMeasurement({ date: "2026-10-04", values: { bp_sys: 120, bp_dia: 80 }, planId: "bp", note: "nach dem Training" });

    const parsed = parseBackup(JSON.stringify(await source.backup.exportCurrentProfile()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = freshDb("plans-target");
    await target.backup.importReplacingCurrentProfile(parsed.backup);
    expect((await target.repos.body.getSettings()).plans).toEqual([plan]);
    const [m] = await target.repos.body.getMeasurements();
    expect(m.planId).toBe("bp");
    expect(m.note).toBe("nach dem Training");
  });

  it("Messungen seitenweise laden: neueste zuerst, ein Tag wird nie zerschnitten, Filter nach Zeitraum", async () => {
    const { repos } = freshDb("paging");
    expect(await repos.body.getMeasurementYearRange()).toBeUndefined();
    expect(await repos.body.getMeasurementsPage({ limit: 10 })).toEqual({ items: [], hasMore: false });
    for (let d = 1; d <= 12; d += 1) {
      await repos.body.saveMeasurement({ date: `2026-09-${String(d).padStart(2, "0")}`, time: "08:00", values: { weight: 80 + d } });
    }
    await repos.body.saveMeasurement({ date: "2026-09-12", time: "20:00", values: { weight: 99 } });
    await repos.body.saveMeasurement({ date: "2025-12-31", values: { weight: 70 } });

    expect(await repos.body.getMeasurementYearRange()).toEqual({ first: 2025, last: 2026 });
    const first = await repos.body.getMeasurementsPage({ limit: 3 });
    // 12.9. (abends vor morgens), 11.9., 10.9. – hasMore, weil davor noch ältere liegen
    expect(first.items.map((m) => `${m.date} ${m.time}`)).toEqual(["2026-09-12 20:00", "2026-09-12 08:00", "2026-09-11 08:00"]);
    expect(first.hasMore).toBe(true);
    // limit 1 liefert trotzdem beide Messungen des 12.9.
    expect((await repos.body.getMeasurementsPage({ limit: 1 })).items).toHaveLength(2);
    const all = await repos.body.getMeasurementsPage({ limit: 50 });
    expect(all.items).toHaveLength(14);
    expect(all.hasMore).toBe(false);
    const filtered = await repos.body.getMeasurementsPage({ from: "2026-09-05", to: "2026-09-06", limit: 10 });
    expect(filtered.items.map((m) => m.date)).toEqual(["2026-09-06", "2026-09-05"]);
    expect(filtered.hasMore).toBe(false);
  });

  it("Round-Trip: eigene Geräte und neue Standardgeräte an eigenen Übungen", async () => {
    const source = freshDb("equip-source");
    await source.repos.settings.update({
      customEquipment: [{ key: "equip-rower-1", name: "Rudergerät", createdAt: "2026-10-05T18:00:00.000Z" }],
    });
    await source.repos.exercises.saveCustom({
      id: "custom-row",
      builtIn: false,
      name: { de: "Rudern", en: "Rowing" },
      bodyRegions: ["back"],
      equipment: ["equip-rower-1", "barbell"],
      trackingType: "cardio",
    });
    const exported = await source.backup.exportCurrentProfile();
    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = freshDb("equip-target");
    await target.backup.importReplacingCurrentProfile(parsed.backup);
    expect((await target.repos.settings.get()).customEquipment?.map((c) => c.name)).toEqual(["Rudergerät"]);
    expect((await target.repos.exercises.getById("custom-row"))?.equipment).toEqual(["equip-rower-1", "barbell"]);

    // ungültige Geräte-Schlüssel werden abgelehnt
    const broken = JSON.parse(JSON.stringify(exported));
    broken.customExercises[0].equipment = ["<script>"];
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it("Backup-Infos: Zeitpunkt des letzten Backups und eigener Daten", async () => {
    const { repos, backup } = freshDb("backup-info");
    expect(await backup.getBackupInfo()).toEqual({ lastBackupAt: undefined, firstDataAt: undefined, lastDataAt: undefined });
    await repos.settings.update({ soundEnabled: false }); // zählt nicht als eigene Daten
    expect((await backup.getBackupInfo()).firstDataAt).toBeUndefined();
    await repos.body.saveMeasurement({ date: "2026-10-04", values: { weight: 75 } });
    const info = await backup.getBackupInfo();
    expect(info.firstDataAt).toBeDefined();
    await backup.markBackupCreated("2026-10-05T10:00:00.000Z");
    expect((await backup.getBackupInfo()).lastBackupAt).toBe("2026-10-05T10:00:00.000Z");
  });
});
