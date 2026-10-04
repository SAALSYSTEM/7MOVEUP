import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, type BackupFile } from "@/data/backup";
import { notifyDataChanged } from "@/data/events";
import type { Exercise, WorkoutPlan, WorkoutSession } from "@/domain/types";

import type { MoveUpDatabase } from "./db";
import type { LocalRepositories } from "./local-repositories";

export interface BackupService {
  /** Export enthält ausschließlich das aktuelle lokale Profil und dessen Daten. */
  exportCurrentProfile(): Promise<BackupFile>;
  /** Ersetzt alle Daten des aktuellen lokalen Profils durch das Backup. */
  importReplacingCurrentProfile(backup: BackupFile): Promise<void>;
}

export function createLocalBackupService(db: MoveUpDatabase, repos: LocalRepositories): BackupService {
  return {
    async exportCurrentProfile() {
      const profileId = await repos.currentProfileId();
      const [profile, settings, customExercises, exerciseNotes, plans, sessions] = await Promise.all([
        repos.profiles.getCurrent(),
        repos.settings.get(),
        db.customExercises.where("profileId").equals(profileId).toArray(),
        db.exerciseNotes.where("profileId").equals(profileId).toArray(),
        db.plans.where("profileId").equals(profileId).toArray(),
        db.sessions.where("profileId").equals(profileId).toArray(),
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
        settings: { soundEnabled: settings.soundEnabled, hapticsEnabled: settings.hapticsEnabled },
      };
    },

    async importReplacingCurrentProfile(backup) {
      const profileId = await repos.currentProfileId();
      const timestamp = new Date().toISOString();

      await db.transaction(
        "rw",
        [db.profiles, db.settings, db.customExercises, db.exerciseNotes, db.plans, db.sessions],
        async () => {
          await db.customExercises.where("profileId").equals(profileId).delete();
          await db.exerciseNotes.where("profileId").equals(profileId).delete();
          await db.plans.where("profileId").equals(profileId).delete();
          await db.sessions.where("profileId").equals(profileId).delete();

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
        },
      );
      notifyDataChanged();
    },
  };
}
