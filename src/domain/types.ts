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

/** Standardgeräte – Reihenfolge = Anzeige. Schlüssel nie ändern, neue einfach ergänzen. */
export const EQUIPMENT = [
  "bodyweight",
  "dumbbells",
  "barbell",
  "kettlebell",
  "bench",
  "machine",
  "cable",
  "pullup_bar",
  "resistance_band",
  "ab_wheel",
  "step",
  "cardio_machine",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** Eigenes Gerät (lokal je Profil, wiederverwendbar) – Schlüssel beginnt mit "equip-" */
export type CustomEquipmentKey = `equip-${string}`;
export type EquipmentKey = Equipment | CustomEquipmentKey;
export type CustomEquipment = { key: CustomEquipmentKey; name: string; createdAt: string };

export const TRACKING_TYPES = ["weight_reps", "reps", "duration", "cardio"] as const;

export type LocalizedText = { de: string; en: string };

export type Profile = {
  id: string;
  displayName?: string;
  language: Language;
  createdAt: string;
  updatedAt: string;
};

/** Anzeige der Körperwerte: metrisch (kg, cm) oder imperial (lb, in). Gespeichert wird immer in kg/cm. */
export type UnitSystem = "metric" | "imperial";

export type Settings = {
  profileId: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** fehlt bei älteren Daten → metrisch */
  unitSystem?: UnitSystem;
  /** eigene Geräte – stehen bei allen eigenen Übungen und im Filter zur Auswahl */
  customEquipment?: CustomEquipment[];
  updatedAt: string;
};

export type Exercise = {
  id: string;
  builtIn: boolean;
  /** nur bei eigenen Übungen gesetzt */
  profileId?: string;
  name: LocalizedText;
  bodyRegions: BodyRegion[];
  equipment: EquipmentKey[];
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

// ------------------------------------------------------------------ Körperwerte

/** Eigener Messwert des Nutzers – Einheit frei, wird nicht umgerechnet. */
export type CustomBodyMetric = {
  /** stabiler Schlüssel, beginnt mit "custom-" */
  key: string;
  name: string;
  /** frei, z. B. "cm" oder "Punkte"; fest, sobald Werte existieren */
  unit: string;
  step: number;
  createdAt: string;
};

/** Auswahl und Reihenfolge der Messwerte, eigene Messwerte, Messtage – je Profil ein Datensatz. */
export type BodySettings = {
  profileId: string;
  /** Reihenfolge = Anzeigereihenfolge; fehlende Standardwerte werden beim Lesen ergänzt */
  metrics: { key: string; enabled: boolean }[];
  custom: CustomBodyMetric[];
  /** Wochentage, an denen gemessen werden soll */
  measureWeekdays: Weekday[];
  updatedAt: string;
};

/** Eine Erfassung (z. B. ein Ablesen der Waage). Werte immer in Basiseinheit (kg, cm, %, kcal). */
export type BodyMeasurement = {
  id: string;
  profileId: string;
  /** lokaler Tag yyyy-MM-dd */
  date: string;
  /** optionale Uhrzeit HH:mm */
  time?: string;
  /** Messwert-Schlüssel → Zahl; nur bestätigte Werte */
  values: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};
