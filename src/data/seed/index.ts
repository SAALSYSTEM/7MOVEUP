import { DEFAULT_SWITCH_SEC } from "@/domain/sides";
import type { BodyRegion, Equipment, Exercise, LocalizedText, TrackingType, Weekday } from "@/domain/types";

import rawExercises from "./exercises.json";
import rawTemplates from "./preset-plans.json";

/**
 * Die Seed-Dateien bleiben 1:1 wie geliefert (deutsche Labels).
 * Hier werden die Labels auf stabile, sprachneutrale Schlüssel gemappt.
 */
const REGION_MAP: Record<string, BodyRegion> = {
  Brust: "chest",
  Schulter: "shoulders",
  Rücken: "back",
  Arme: "arms",
  Trizeps: "arms",
  Bizeps: "arms",
  Core: "core",
  Gesäß: "glutes",
  Beine: "legs",
  Waden: "calves",
  Ganzkörper: "full_body",
  "Stabilität/Mobility": "stability",
};

const EQUIPMENT_MAP: Record<string, Equipment> = {
  Körpergewicht: "bodyweight",
  Kurzhanteln: "dumbbells",
  Hantelbank: "bench",
  Kettlebell: "kettlebell",
  Bauchrolle: "ab_wheel",
  "Step/Erhöhung": "step",
  "Ergometer/Cardio": "cardio_machine",
};

type RawExercise = (typeof rawExercises)[number] & { videoUrls?: string[] };

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function mapExercise(raw: RawExercise): Exercise {
  return {
    id: raw.id,
    builtIn: true,
    name: raw.name,
    bodyRegions: unique(raw.bodyRegions.map((r) => REGION_MAP[r]).filter(Boolean)),
    equipment: unique(raw.equipment.map((e) => EQUIPMENT_MAP[e]).filter(Boolean)),
    trackingType: raw.trackingType as TrackingType,
    defaultSets: raw.defaultSets,
    defaultRepMin: "defaultRepMin" in raw ? raw.defaultRepMin : undefined,
    defaultRepMax: "defaultRepMax" in raw ? raw.defaultRepMax : undefined,
    defaultDurationSec: "defaultDurationSec" in raw ? raw.defaultDurationSec : undefined,
    defaultRestSec: raw.defaultRestSec,
    videoUrls: raw.videoUrls,
  };
}

/**
 * Ergänzung zur gelieferten Bibliothek: Die 6-Tage-Vorlage enthält zwei
 * Ergometer-Tage, die 40 Seed-Übungen aber keine Cardio-Übung. Damit diese Tage
 * protokolliert werden können, gibt es genau diese eine zusätzliche Built-in-Übung.
 */
export const ERGOMETER_EXERCISE: Exercise = {
  id: "ergometer",
  builtIn: true,
  name: { de: "Ergometer", en: "Stationary Bike" },
  bodyRegions: ["full_body", "legs"],
  equipment: ["cardio_machine"],
  trackingType: "cardio",
  defaultSets: 1,
  defaultDurationSec: 30 * 60,
};

export const SEED_EXERCISE_COUNT = rawExercises.length;

export const BUILT_IN_EXERCISES: Exercise[] = [
  ...(rawExercises as RawExercise[]).map(mapExercise),
  ERGOMETER_EXERCISE,
];

/**
 * Eindeutig einseitige Übungen: Beim NEUEN Anlegen einer Planübung (Vorlage übernehmen, Übung aus dem
 * Katalog hinzufügen) startet „Je Seite“ eingeschaltet. Bestehende Planübungen werden nie angefasst –
 * diese Liste wird weder beim Laden noch beim Starten eines Trainings gelesen. Alles andere (z. B.
 * Ausfallschritte, Step-ups, Wadenheben) schaltet der Nutzer selbst ein.
 */
const PER_SIDE_DEFAULT_IDS = new Set([
  "one-arm-db-row",
  "bulgarian-split-squat",
  "single-leg-glute-bridge",
  "clamshell",
  "side-plank",
  "single-leg-stand",
  "suitcase-carry",
]);

/** `{ perSide, switchSec }` für eine neue Planübung dieser Übung – leer, wenn kein Default gilt. */
export function perSideDefaults(
  exercise: Pick<Exercise, "id" | "builtIn" | "trackingType"> | undefined,
): { perSide?: true; switchSec?: number } {
  if (!exercise?.builtIn || !PER_SIDE_DEFAULT_IDS.has(exercise.id) || exercise.trackingType === "cardio") return {};
  return exercise.trackingType === "duration" ? { perSide: true, switchSec: DEFAULT_SWITCH_SEC } : { perSide: true };
}

const BUILT_IN_BY_ID = new Map(BUILT_IN_EXERCISES.map((e) => [e.id, e]));

// ---------------------------------------------------------------------------
// Vorlagen
// ---------------------------------------------------------------------------

type RawTemplateItem = {
  exerciseId: string;
  sets: number;
  repMin?: number;
  repMax?: number;
  durationSec?: number;
  restSec?: number;
  suggestedWeightPerDumbbellKg?: number[];
  suggestedWeightKg?: number[];
};

type RawCardio = {
  type: string;
  durationMin?: number[];
  intensity?: string;
  warmupMin?: number;
  rounds?: number;
  workSec?: number;
  easySec?: number;
  cooldownMin?: number;
};

type RawTemplateDay = {
  name: LocalizedText;
  items?: RawTemplateItem[];
  cardio?: RawCardio;
  rest?: boolean;
  notes?: LocalizedText;
};

type RawTemplate = {
  id: string;
  name: LocalizedText;
  days: RawTemplateDay[];
  planNotes?: { de: string[]; en: string[] };
};

export type TemplateItem = {
  exerciseId: string;
  sets: number;
  repMin?: number;
  repMax?: number;
  durationSec?: number;
  restSec?: number;
  weightStepsKg?: number[];
  perSide?: boolean;
  switchSec?: number;
  note?: LocalizedText;
};

export type TemplateDay = {
  name: LocalizedText;
  weekday?: Weekday;
  items: TemplateItem[];
  notes?: LocalizedText;
};

export type WorkoutTemplate = {
  id: string;
  name: LocalizedText;
  days: TemplateDay[];
  planNotes?: LocalizedText;
  progressionStepKg?: number;
};

/** Vorschlag für Wochentage beim Übernehmen – jederzeit änderbar. */
const DEFAULT_WEEKDAYS: Record<string, Weekday[]> = {
  "template-4day-strength-core": [1, 2, 4, 5],
  "template-6day-fitness-strength": [1, 2, 3, 4, 5, 6, 7],
  "template-4day-bodyweight": [1, 2, 4, 5],
};

/** Strengere Kraftvorlage: +2 kg als Hinweis bei erreichtem Wiederholungsziel */
const PROGRESSION_STEP: Record<string, number> = {
  "template-4day-strength-core": 2,
};

function cardioItem(cardio: RawCardio): TemplateItem {
  if (cardio.type === "ergometer_intervals") {
    const warm = cardio.warmupMin ?? 0;
    const cool = cardio.cooldownMin ?? 0;
    const rounds = cardio.rounds ?? 0;
    const work = cardio.workSec ?? 0;
    const easy = cardio.easySec ?? 0;
    const totalMin = Math.round(warm + cool + (rounds * (work + easy)) / 60);
    return {
      exerciseId: ERGOMETER_EXERCISE.id,
      sets: 1,
      durationSec: totalMin * 60,
      note: {
        de: `${warm} Min einfahren · ${rounds} × (${work} s zügig + ${easy} s locker) · ${cool} Min ausfahren`,
        en: `${warm} min warm-up · ${rounds} × (${work} s hard + ${easy} s easy) · ${cool} min cool-down`,
      },
    };
  }
  const [min, max] = cardio.durationMin ?? [30, 30];
  return {
    exerciseId: ERGOMETER_EXERCISE.id,
    sets: 1,
    durationSec: min * 60,
    note: {
      de: `${min}${max && max !== min ? `–${max}` : ""} Min, locker`,
      en: `${min}${max && max !== min ? `–${max}` : ""} min, easy`,
    },
  };
}

function mapTemplate(raw: RawTemplate): WorkoutTemplate {
  const weekdays = DEFAULT_WEEKDAYS[raw.id] ?? [];
  let weekdayIndex = 0;
  const days: TemplateDay[] = [];

  for (const day of raw.days) {
    const weekday = weekdays[weekdayIndex];
    weekdayIndex += 1;
    if (day.rest) continue;
    const items: TemplateItem[] = day.cardio
      ? [cardioItem(day.cardio)]
      : (day.items ?? []).map((item) => ({
          exerciseId: item.exerciseId,
          sets: item.sets,
          repMin: item.repMin,
          repMax: item.repMax,
          durationSec: item.durationSec,
          restSec: item.restSec,
          weightStepsKg: item.suggestedWeightPerDumbbellKg ?? item.suggestedWeightKg,
          ...perSideDefaults(BUILT_IN_BY_ID.get(item.exerciseId)),
        }));
    days.push({ name: day.name, weekday, items, notes: day.notes });
  }

  return {
    id: raw.id,
    name: raw.name,
    days,
    planNotes: raw.planNotes
      ? { de: raw.planNotes.de.join("\n"), en: raw.planNotes.en.join("\n") }
      : undefined,
    progressionStepKg: PROGRESSION_STEP[raw.id],
  };
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = (rawTemplates as RawTemplate[]).map(mapTemplate);
