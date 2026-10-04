import type {
  Exercise,
  ExerciseNote,
  PerformanceSnapshot,
  Profile,
  Settings,
  WorkoutPlan,
  WorkoutSession,
} from "@/domain/types";

/**
 * Repository-Schnittstellen. Die UI kennt nur diese Verträge.
 * V1: lokale Implementierung (Dexie/IndexedDB) in `./local`.
 * Später: Supabase-Implementierung mit denselben Signaturen.
 * Alle Methoden arbeiten implizit auf dem aktuell lokalen Profil.
 */

export interface ProfileRepository {
  /** liefert das aktuelle Profil, legt beim ersten Start ein Standardprofil an */
  getCurrent(): Promise<Profile>;
  update(patch: Partial<Pick<Profile, "displayName" | "language">>): Promise<Profile>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(patch: Partial<Pick<Settings, "soundEnabled" | "hapticsEnabled">>): Promise<Settings>;
}

export interface ExerciseRepository {
  getAll(): Promise<Exercise[]>;
  getById(id: string): Promise<Exercise | undefined>;
  saveCustom(exercise: Exercise): Promise<Exercise>;
  deleteCustom(id: string): Promise<void>;
  getNote(exerciseId: string): Promise<ExerciseNote | undefined>;
  getNotes(): Promise<ExerciseNote[]>;
  saveNote(exerciseId: string, patch: Partial<Pick<ExerciseNote, "note" | "videoUrls">>): Promise<ExerciseNote>;
}

export interface PlanRepository {
  getAll(): Promise<WorkoutPlan[]>;
  getById(id: string): Promise<WorkoutPlan | undefined>;
  save(plan: WorkoutPlan): Promise<WorkoutPlan>;
  saveMany(plans: WorkoutPlan[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WorkoutRepository {
  getSession(id: string): Promise<WorkoutSession | undefined>;
  getActiveSession(): Promise<WorkoutSession | undefined>;
  getCompletedSessions(): Promise<WorkoutSession[]>;
  saveSession(session: WorkoutSession): Promise<WorkoutSession>;
  deleteSession(id: string): Promise<void>;
  /** letzte abgeschlossene Leistung einer Übung, optional vor einem Zeitpunkt */
  getLastPerformance(exerciseId: string, beforeIso?: string): Promise<PerformanceSnapshot | undefined>;
}
