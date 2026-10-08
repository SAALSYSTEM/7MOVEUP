import { z } from "zod";

import { BODY_REGIONS, EQUIPMENT, TRACKING_TYPES, type CustomEquipmentKey } from "@/domain/types";

export const BACKUP_APP_ID = "7MOVEUP";
/**
 * 1 = V1 (Profil, Übungen, Notizen, Pläne, Trainings, Einstellungen)
 * 2 = + Körperwerte (Messungen, Messwert-Auswahl, Messtage) und Einheiten-Einstellung.
 * Version-1-Dateien bleiben importierbar: die neuen Felder sind optional.
 */
export const BACKUP_SCHEMA_VERSION = 2;

const isoDate = z.string().min(1);

/** eigenes Gerät: "equip-<id>" */
const customEquipmentKey = z
  .string()
  .regex(/^equip-[A-Za-z0-9-]{1,64}$/)
  .transform((key) => key as CustomEquipmentKey);
const customEquipmentSchema = z.object({
  key: customEquipmentKey,
  name: z.string().trim().min(1).max(40),
  createdAt: isoDate,
});
const localized = z.object({ de: z.string(), en: z.string() });
const optionalNumber = z.number().finite().nonnegative().optional();

const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().max(60).optional(),
  language: z.enum(["de", "en"]),
  createdAt: isoDate,
  updatedAt: isoDate,
});

const exerciseSchema = z.object({
  id: z.string().min(1),
  builtIn: z.literal(false).default(false),
  profileId: z.string().optional(),
  name: localized,
  bodyRegions: z.array(z.enum(BODY_REGIONS)),
  equipment: z.array(z.union([z.enum(EQUIPMENT), customEquipmentKey])),
  trackingType: z.enum(TRACKING_TYPES),
  defaultSets: optionalNumber,
  defaultRepMin: optionalNumber,
  defaultRepMax: optionalNumber,
  defaultDurationSec: optionalNumber,
  defaultRestSec: optionalNumber,
  videoUrls: z.array(z.string()).optional(),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional(),
});

const noteSchema = z.object({
  profileId: z.string().optional(),
  exerciseId: z.string().min(1),
  note: z.string(),
  videoUrls: z.array(z.string()).optional(),
  updatedAt: isoDate,
});

const planItemSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20),
  repMin: optionalNumber,
  repMax: optionalNumber,
  durationSec: optionalNumber,
  restSec: optionalNumber,
  weightStepsKg: z.array(z.number().nonnegative()).optional(),
  perSide: z.boolean().optional(),
  switchSec: optionalNumber,
  note: z.string().optional(),
});

const planSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().optional(),
  name: z.string().min(1),
  items: z.array(planItemSchema),
  weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  notes: z.string().optional(),
  group: z.string().optional(),
  templateId: z.string().optional(),
  progressionStepKg: optionalNumber,
  createdAt: isoDate,
  updatedAt: isoDate,
});

const setSchema = z.object({
  weightPerDumbbellKg: optionalNumber,
  reps: optionalNumber,
  durationSec: optionalNumber,
  watts: optionalNumber,
  rpm: optionalNumber,
  heartRate: optionalNumber,
  done: z.boolean(),
  completedAt: isoDate.optional(),
  side: z.enum(["left", "right"]).optional(),
});

const sessionSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().optional(),
  planId: z.string().optional(),
  planName: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: isoDate,
  completedAt: isoDate.optional(),
  durationSec: optionalNumber,
  progressionStepKg: optionalNumber,
  exercises: z.array(
    z.object({
      id: z.string().min(1),
      exerciseId: z.string().min(1),
      name: localized,
      trackingType: z.enum(TRACKING_TYPES),
      target: z.object({
        sets: z.number().int().min(0),
        repMin: optionalNumber,
        repMax: optionalNumber,
        durationSec: optionalNumber,
        restSec: optionalNumber,
        weightStepsKg: z.array(z.number().nonnegative()).optional(),
        perSide: z.boolean().optional(),
        switchSec: optionalNumber,
        note: z.string().optional(),
      }),
      sets: z.array(setSchema),
    }),
  ),
});

const customMetricSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).max(60),
  unit: z.string().max(20),
  step: z.number().positive(),
  createdAt: isoDate,
});

const measurePlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(60),
  metricKeys: z.array(z.string().min(1)).optional(),
  weekdays: z.array(z.number().int().min(1).max(7)),
  perDay: z.number().int().min(1).max(5),
});

const bodySettingsSchema = z.object({
  profileId: z.string().optional(),
  metrics: z.array(z.object({ key: z.string().min(1), enabled: z.boolean() })),
  custom: z.array(customMetricSchema).default([]),
  measureWeekdays: z.array(z.number().int().min(1).max(7)).default([]),
  plans: z.array(measurePlanSchema).optional(),
  updatedAt: isoDate,
});

const measurementSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  values: z.record(z.string(), z.number().finite()),
  planId: z.string().optional(),
  note: z.string().max(200).optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  schemaVersion: z.number().int().min(1),
  exportedAt: isoDate,
  profile: profileSchema,
  customExercises: z.array(exerciseSchema).default([]),
  exerciseNotes: z.array(noteSchema).default([]),
  plans: z.array(planSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  settings: z
    .object({
      soundEnabled: z.boolean().default(true),
      hapticsEnabled: z.boolean().default(true),
      unitSystem: z.enum(["metric", "imperial"]).optional(),
      customEquipment: z.array(customEquipmentSchema).optional(),
    })
    .default({ soundEnabled: true, hapticsEnabled: true }),
  // ab Version 2 – fehlen in Version-1-Dateien
  bodySettings: bodySettingsSchema.optional(),
  measurements: z.array(measurementSchema).default([]),
});

export type BackupFile = z.infer<typeof backupSchema>;

export type BackupParseError =
  | { kind: "invalid_json" }
  | { kind: "wrong_app" }
  | { kind: "newer_version"; version: number }
  | { kind: "invalid_data"; issues: string[] };

export type BackupParseResult = { ok: true; backup: BackupFile } | { ok: false; error: BackupParseError };

/**
 * Migrationen älterer Schema-Versionen landen hier.
 * 1 → 2: nichts umzubauen, Körperwerte fehlen einfach (Standardwerte greifen).
 * Neuere Dateien werden abgelehnt statt still Daten zu verlieren.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: "invalid_json" } };
  }
  if (!raw || typeof raw !== "object" || (raw as { app?: unknown }).app !== BACKUP_APP_ID) {
    return { ok: false, error: { kind: "wrong_app" } };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version === "number" && version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: { kind: "newer_version", version } };
  }
  const result = backupSchema.safeParse(migrate(raw as Record<string, unknown>));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    return { ok: false, error: { kind: "invalid_data", issues } };
  }
  return { ok: true, backup: result.data };
}
