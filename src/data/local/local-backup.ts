import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, type BackupFile } from "@/data/backup";
import { notifyDataChanged } from "@/data/events";
import { normalizeBodySettings } from "@/domain/body";
import type { BodyMeasurement, BodySettings, Exercise, Weekday, WorkoutPlan, WorkoutSession } from "@/domain/types";

import type { MoveUpDatabase } from "./db";
import type { LocalRepositories } from "./local-repositories";

const LAST_BACKUP_KEY = "lastBackupAt";

export type BackupInfo = {
  /** Zeitpunkt des letzten erfolgreichen Exports (bzw. des importierten Backups) */
  lastBackupAt?: string;
  /** frühester / spätester Zeitpunkt eigener Daten – für den Backup-Hinweis */
  firstDataAt?: string;
  lastDataAt?: string;
};

export interface BackupService {
  /** Export enthält ausschließlich das aktuelle lokale Profil und dessen Daten. */
  exportCurrentProfile(): Promise<BackupFile>;
  /** Ersetzt alle Daten des aktuellen lokalen Profils durch das Backup. */
  importReplacingCurrentProfile(backup: BackupFile): Promise<void>;
  /** nach erfolgreichem Export aufrufen */
  markBackupCreated(at?: string): Promise<void>;
  getBackupInfo(): Promise<BackupInfo>;
}

export function createLocalBackupService(db: MoveUpDatabase, repos: LocalRepositories): BackupService {
  return {
    async exportCurrentProfile() {
      const profileId = await repos.currentProfileId();
      const [profile, settings, customExercises, exerciseNotes, plans, sessions, bodySettings, measurements] =
        await Promise.all([
          repos.profiles.getCurrent(),
          repos.settings.get(),
          db.customExercises.where("profileId").equals(profileId).toArray(),
          db.exerciseNotes.where("profileId").equals(profileId).toArray(),
          db.plans.where("profileId").equals(profileId).toArray(),
          db.sessions.where("profileId").equals(profileId).toArray(),
          db.bodySettings.get(profileId),
          db.measurements.where("profileId").equals(profileId).toArray(),
        ]);
      return {
        app: BACKUP_APP_ID,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        profile,
        customExercises: customExercises.map((e) => ({ ...e, builtIn: false as const })),
        exerciseNotes,
        plans,
        sessions,
        settings: {
          soundEnabled: settings.soundEnabled,
          hapticsEnabled: settings.hapticsEnabled,
          unitSystem: settings.unitSystem,
          customEquipment: settings.customEquipment,
        },
        bodySettings,
        measurements,
      };
    },

    async importReplacingCurrentProfile(backup) {
      const profileId = await repos.currentProfileId();
      const timestamp = new Date().toISOString();

      await db.transaction(
        "rw",
        [
          db.profiles,
          db.settings,
          db.customExercises,
          db.exerciseNotes,
          db.plans,
          db.sessions,
          db.bodySettings,
          db.measurements,
          db.meta,
        ],
        async () => {
          await db.customExercises.where("profileId").equals(profileId).delete();
          await db.exerciseNotes.where("profileId").equals(profileId).delete();
          await db.plans.where("profileId").equals(profileId).delete();
          await db.sessions.where("profileId").equals(profileId).delete();
          await db.measurements.where("profileId").equals(profileId).delete();
          await db.bodySettings.delete(profileId);

          const current = await db.profiles.get(profileId);
          await db.profiles.put({
            id: profileId,
            displayName: backup.profile.displayName,
            language: backup.profile.language,
            createdAt: current?.createdAt ?? backup.profile.createdAt,
            updatedAt: timestamp,
          });
          await db.settings.put({ profileId, ...backup.settings, updatedAt: timestamp });

          await db.customExercises.bulkPut(
            backup.customExercises.map((e): Exercise => ({ ...e, builtIn: false, profileId })),
          );
          await db.exerciseNotes.bulkPut(backup.exerciseNotes.map((n) => ({ ...n, profileId })));
          await db.plans.bulkPut(
            backup.plans.map((p): WorkoutPlan => ({ ...p, profileId, weekdays: p.weekdays as WorkoutPlan["weekdays"] })),
          );
          await db.sessions.bulkPut(backup.sessions.map((s): WorkoutSession => ({ ...s, profileId })));

          if (backup.bodySettings) {
            const settings: BodySettings = normalizeBodySettings({
              ...backup.bodySettings,
              profileId,
              measureWeekdays: backup.bodySettings.measureWeekdays as Weekday[],
            });
            await db.bodySettings.put(settings);
          }
          await db.measurements.bulkPut(backup.measurements.map((m): BodyMeasurement => ({ ...m, profileId })));

          // Die Daten entsprechen jetzt genau diesem Backup
          await db.meta.put({ key: LAST_BACKUP_KEY, value: backup.exportedAt });
        },
      );
      notifyDataChanged();
    },

    async markBackupCreated(at = new Date().toISOString()) {
      await db.meta.put({ key: LAST_BACKUP_KEY, value: at });
      notifyDataChanged();
    },

    async getBackupInfo() {
      const profileId = await repos.currentProfileId();
      const [meta, sessions, plans, customExercises, notes, measurements, bodySettings] = await Promise.all([
        db.meta.get(LAST_BACKUP_KEY),
        db.sessions.where("profileId").equals(profileId).toArray(),
        db.plans.where("profileId").equals(profileId).toArray(),
        db.customExercises.where("profileId").equals(profileId).toArray(),
        db.exerciseNotes.where("profileId").equals(profileId).toArray(),
        db.measurements.where("profileId").equals(profileId).toArray(),
        db.bodySettings.get(profileId),
      ]);
      // Zeitpunkte eigener Daten (Einstellungen wie Ton/Sprache zählen nicht)
      const stamps: string[] = [
        ...sessions.flatMap((s) => [s.startedAt, s.completedAt ?? s.startedAt]),
        ...plans.flatMap((p) => [p.createdAt, p.updatedAt]),
        ...customExercises.flatMap((e) => [e.createdAt, e.updatedAt].filter((x): x is string => Boolean(x))),
        ...notes.map((n) => n.updatedAt),
        ...measurements.flatMap((m) => [m.createdAt, m.updatedAt]),
        ...(bodySettings ? [bodySettings.updatedAt] : []),
      ].filter(Boolean);
      stamps.sort();
      return { lastBackupAt: meta?.value, firstDataAt: stamps[0], lastDataAt: stamps.at(-1) };
    },
  };
}
