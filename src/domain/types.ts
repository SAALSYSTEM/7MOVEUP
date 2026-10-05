/**
 * Domänenmodell von 7MOVEUP.
 * Bewusst frei von Speicher-Details (Dexie, später Supabase).
 */

export type Language = "de" | "en";

export type TrackingType = "weight_reps" | "reps" | "duration" | "cardio";

export const BODY_REGIONS = [
  "chest",
  "shoulders",
  "back",
  "arms",
  "core",
  "glutes",
  "legs",
  "calves",
  "full_body",
  "stability",
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export const EQUIPMENT = [
  "bodyweight",
  "dumbbells",
  "bench",
  "kettlebell",
  "ab_wheel",
  "step",
  "cardio_machine",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const TRACKING_TYPES = ["weight_reps", "reps", "duration", "cardio"] as const;

export type LocalizedText = { de: string; en: string };

export type Profile = {
  id: string;
  displayName?: string;
  language: Language;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  profileId: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  updatedAt: string;
};

export type Exercise = {
  id: string;
  builtIn: boolean;
  /** nur bei eigenen Übungen gesetzt */
  profileId?: string;
  name: LocalizedText;
  bodyRegions: BodyRegion[];
  equipment: Equipment[];
  trackingType: TrackingType;
  defaultSets?: number;
  defaultRepMin?: number;
  defaultRepMax?: number;
  defaultDurationSec?: number;
  defaultRestSec?: number;
  videoUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
};

/** Persönliche, profilbezogene Ergänzung zu jeder Übung (auch Built-ins). */
export type ExerciseNote = {
  profileId: string;
  exerciseId: string;
  note: string;
  /** zusätzliche eigene Video-Links des Nutzers */
  videoUrls?: string[];
  updatedAt: string;
};

export type WorkoutPlanItem = {
  id: string;
  exerciseId: string;
  sets: number;
  repMin?: number;
  repMax?: number;
  durationSec?: number;
  restSec?: number;
  /** Gewichtsstufen als Schnellauswahl, Angabe in kg je Hantel */
  weightStepsKg?: number[];
  note?: string;
};

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WorkoutPlan = {
  id: string;
  profileId: string;
  name: string;
  items: WorkoutPlanItem[];
  weekdays: Weekday[];
  notes?: string;
  /** Gruppenname, z. B. Name der übernommenen Vorlage */
  group?: string;
  templateId?: string;
  /** Empfohlene Steigerung in kg je Hantel, wenn das Wiederholungsziel erreicht ist */
  progressionStepKg?: number;
  createdAt: string;
  updatedAt: string;
};

export type SetLog = {
  /** Gewicht der einzelnen benutzten Hantel (kg je Hantel) */
  weightPerDumbbellKg?: number;
  reps?: number;
  durationSec?: number;
  watts?: number;
  rpm?: number;
  heartRate?: number;
  done: boolean;
  completedAt?: string;
};

export type SessionTarget = {
  sets: number;
  repMin?: number;
  repMax?: number;
  durationSec?: number;
  restSec?: number;
  weightStepsKg?: number[];
  note?: string;
};

export type SessionExercise = {
  id: string;
  exerciseId: string;
  /** Snapshot, falls die Übung später gelöscht/umbenannt wird */
  name: LocalizedText;
  trackingType: TrackingType;
  target: SessionTarget;
  sets: SetLog[];
};

export type WorkoutSession = {
  id: string;
  profileId: string;
  planId?: string;
  planName: string;
  /** lokales Datum yyyy-MM-dd, an dem das Training stattfand */
  date: string;
  startedAt: string;
  completedAt?: string;
  durationSec?: number;
  progressionStepKg?: number;
  exercises: SessionExercise[];
  /** laufende Timer eines offenen Trainings – überstehen so einen Neustart der App (nicht im Backup) */
  timers?: SessionTimers;
};

export type SetTimerState = {
  /** SessionExercise.id */
  entryId: string;
  setIndex: number;
  durationSec: number;
  status: "running" | "paused";
  /** Endzeitpunkt (ISO), solange er läuft */
  endAt?: string;
  /** Restzeit, solange pausiert */
  remainingMs?: number;
};

export type RestTimerState = { endAt: string; seconds: number; label: string };

export type SessionTimers = {
  /** Zeit-Timer eines Satzes (Zeitübung oder Cardio) */
  set?: SetTimerState;
  /** Pause nach einem abgehakten Satz */
  rest?: RestTimerState;
};

export type PerformanceSnapshot = {
  sessionId: string;
  date: string;
  trackingType: TrackingType;
  target: SessionTarget;
  sets: SetLog[];
};
