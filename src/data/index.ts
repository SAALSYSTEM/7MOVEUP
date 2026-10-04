/**
 * Einziger Einstiegspunkt der UI in die Datenschicht.
 * Für Supabase später hier eine andere Implementierung einsetzen.
 */
import { db } from "./local/db";
import { createLocalBackupService } from "./local/local-backup";
import { createLocalRepositories } from "./local/local-repositories";

const local = createLocalRepositories(db);

export const profileRepository = local.profiles;
export const settingsRepository = local.settings;
export const exerciseRepository = local.exercises;
export const planRepository = local.plans;
export const workoutRepository = local.workouts;
export const backupService = createLocalBackupService(db, local);

/** Persistenten Speicher anfragen, damit der Browser IndexedDB nicht still räumt. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    // optional – nicht jeder Browser unterstützt das
  }
}

export type { BackupService } from "./local/local-backup";
