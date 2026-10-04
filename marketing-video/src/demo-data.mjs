/**
 * Realistische Demo-Daten als 7MOVEUP-Backup (Schema 1).
 * Werden in der Aufnahme über die echte Import-Funktion der App geladen.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(here, "../../src/data/seed");
const exercises = JSON.parse(fs.readFileSync(path.join(seedDir, "exercises.json"), "utf8"));
const templates = JSON.parse(fs.readFileSync(path.join(seedDir, "preset-plans.json"), "utf8"));

const ERGOMETER = { id: "ergometer", name: { de: "Ergometer", en: "Stationary Bike" }, trackingType: "cardio" };

function exercise(id) {
  if (id === ERGOMETER.id) return ERGOMETER;
  const found = exercises.find((e) => e.id === id);
  if (!found) throw new Error(`Unbekannte Übung ${id}`);
  return found;
}

const TEXT = {
  de: {
    group: "4-Tage Kraft & Core",
    cardio: "Cardio",
    cardioNote: "locker, 70–90 RPM",
    note: "Schulterblätter hinten/unten halten.",
  },
  en: {
    group: "4-Day Strength & Core",
    cardio: "Cardio",
    cardioNote: "easy, 70–90 RPM",
    note: "Keep shoulder blades back and down.",
  },
};

/** lokales Datum relativ zum Demo-Tag (Mo 9.11.2026) */
function day(offset, hh = 18, mm = 0) {
  const d = new Date(Date.UTC(2026, 10, 9 + offset, hh - 1, mm)); // CET = UTC+1
  return d;
}
const dateKey = (d) => {
  const local = new Date(d.getTime() + 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

export function buildDemoBackup(lang) {
  const t = TEXT[lang];
  const strength = templates.find((tpl) => tpl.id === "template-4day-strength-core");
  const createdBase = Date.UTC(2026, 9, 19, 8, 0);
  const weekdays = [1, 2, 4, 5];

  const plans = strength.days.map((d, i) => ({
    id: `demo-plan-${i + 1}`,
    name: d.name[lang],
    group: t.group,
    templateId: strength.id,
    weekdays: [weekdays[i]],
    progressionStepKg: 2,
    items: d.items.map((item, j) => ({
      id: `demo-item-${i + 1}-${j + 1}`,
      exerciseId: item.exerciseId,
      sets: item.sets,
      repMin: item.repMin,
      repMax: item.repMax,
      durationSec: item.durationSec,
      restSec: item.restSec,
      weightStepsKg: item.suggestedWeightPerDumbbellKg ?? item.suggestedWeightKg,
    })),
    createdAt: new Date(createdBase + i).toISOString(),
    updatedAt: new Date(createdBase + i).toISOString(),
  }));

  plans.push({
    id: "demo-plan-cardio",
    name: t.cardio,
    weekdays: [1, 3],
    items: [{ id: "demo-item-cardio", exerciseId: "ergometer", sets: 1, durationSec: 30 * 60, note: t.cardioNote }],
    createdAt: new Date(createdBase + 10).toISOString(),
    updatedAt: new Date(createdBase + 10).toISOString(),
  });

  const planById = Object.fromEntries(plans.map((p) => [p.id, p]));
  let counter = 0;

  /** Einheit aus einem Plan; values[exerciseId] = Satzwerte */
  function session(planId, start, minutes, values) {
    const plan = planById[planId];
    const startedAt = start.toISOString();
    const completedAt = new Date(start.getTime() + minutes * 60_000).toISOString();
    counter += 1;
    return {
      id: `demo-session-${counter}`,
      planId,
      planName: plan.name,
      date: dateKey(start),
      startedAt,
      completedAt,
      durationSec: minutes * 60,
      progressionStepKg: plan.progressionStepKg,
      exercises: plan.items
        .filter((item) => values[item.exerciseId])
        .map((item, k) => {
          const ex = exercise(item.exerciseId);
          return {
            id: `demo-se-${counter}-${k}`,
            exerciseId: item.exerciseId,
            name: ex.name,
            trackingType: ex.trackingType,
            target: {
              sets: item.sets,
              repMin: item.repMin,
              repMax: item.repMax,
              durationSec: item.durationSec,
              restSec: item.restSec,
              weightStepsKg: item.weightStepsKg,
              note: item.note,
            },
            sets: values[item.exerciseId].map((s) => ({ ...s, done: true, completedAt })),
          };
        }),
    };
  }

  const wr = (kg, reps) => reps.map((r) => ({ weightPerDumbbellKg: kg, reps: r }));
  const secs = (s, n) => Array.from({ length: n }, () => ({ durationSec: s }));
  const reps = (list) => list.map((r) => ({ reps: r }));

  const sessions = [
    // Woche 44
    session("demo-plan-1", day(-14), 52, {
      "db-flat-bench-press": wr(20, [10, 9, 9, 8]),
      "db-incline-bench-press": wr(16, [10, 9, 8]),
      "seated-db-shoulder-press": wr(10, [10, 9, 9]),
      "lateral-raise": wr(6, [15, 14, 12]),
      plank: secs(40, 3),
    }),
    session("demo-plan-2", day(-13), 55, {
      "db-rdl": wr(20, [8, 8, 8, 8]),
      "goblet-squat": wr(18, [10, 9, 9]),
      "ab-wheel": reps([8, 8, 7]),
    }),
    session("demo-plan-cardio", day(-12, 7, 0), 25, { ergometer: [{ durationSec: 25 * 60, watts: 118, rpm: 80, heartRate: 116 }] }),
    session("demo-plan-3", day(-11), 48, {
      "one-arm-db-row": wr(16, [10, 10, 9, 9]),
      "bent-over-db-row": wr(14, [10, 9, 9]),
      "side-plank": secs(30, 3),
    }),
    session("demo-plan-4", day(-10), 45, {
      "goblet-squat": wr(18, [10, 10, 9]),
      "farmer-carry": secs(35, 3).map((s) => ({ ...s, weightPerDumbbellKg: 20 })),
      "ab-wheel": reps([8, 8, 8]),
    }),
    // Woche 45
    session("demo-plan-1", day(-7), 50, {
      "db-flat-bench-press": wr(20, [10, 10, 10, 10]),
      "db-incline-bench-press": wr(16, [10, 10, 9]),
      "seated-db-shoulder-press": wr(10, [10, 10, 10]),
      "lateral-raise": wr(6, [15, 15, 14]),
      plank: secs(40, 3),
    }),
    session("demo-plan-2", day(-6), 54, {
      "db-rdl": wr(22, [8, 8, 8, 8]),
      "goblet-squat": wr(18, [10, 10, 10]),
      "ab-wheel": reps([8, 8, 8]),
    }),
    session("demo-plan-cardio", day(-5, 7, 0), 30, { ergometer: [{ durationSec: 30 * 60, watts: 122, rpm: 82, heartRate: 118 }] }),
    session("demo-plan-3", day(-4), 49, {
      "one-arm-db-row": wr(16, [10, 10, 10, 10]),
      "bent-over-db-row": wr(14, [10, 10, 9]),
      "side-plank": secs(30, 3),
    }),
    session("demo-plan-4", day(-3), 46, {
      "goblet-squat": wr(20, [9, 9, 8]),
      "farmer-carry": secs(35, 3).map((s) => ({ ...s, weightPerDumbbellKg: 22 })),
      "ab-wheel": reps([8, 8, 8]),
    }),
    // heute morgen
    session("demo-plan-cardio", day(0, 7, 0), 30, { ergometer: [{ durationSec: 30 * 60, watts: 125, rpm: 84, heartRate: 118 }] }),
  ];

  const now = "2026-11-09T17:00:00.000Z";
  return {
    app: "7MOVEUP",
    schemaVersion: 1,
    exportedAt: now,
    profile: { id: "demo-profile", language: lang, createdAt: "2026-10-19T08:00:00.000Z", updatedAt: now },
    customExercises: [],
    exerciseNotes: [{ exerciseId: "db-flat-bench-press", note: t.note, updatedAt: now }],
    plans,
    sessions,
    settings: { soundEnabled: true, hapticsEnabled: true },
  };
}

export const DEMO_NOTE = Object.fromEntries(Object.entries(TEXT).map(([k, v]) => [k, v.note]));
