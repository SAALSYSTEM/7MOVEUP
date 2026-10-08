import type { Exercise, Language, SessionTarget, TrackingType } from "@/domain/types";
import type { Translate } from "@/i18n";

/** Kurzhantel-/Kettlebell-Übungen: Gewicht immer als kg der einzelnen Hantel. */
export function usesPerDumbbellWeight(exercise: Pick<Exercise, "equipment"> | undefined): boolean {
  return Boolean(exercise?.equipment.some((e) => e === "dumbbells" || e === "kettlebell"));
}

export function weightUnitLabel(exercise: Pick<Exercise, "equipment"> | undefined, t: Translate): string {
  return usesPerDumbbellWeight(exercise) ? t("common.kgPerDumbbell") : t("common.kg");
}

export function formatKg(value: number | undefined, language: Language): string {
  if (value == null) return "–";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return language === "de" ? text.replace(".", ",") : text;
}

export function formatSeconds(sec: number | undefined, t: Translate): string {
  if (!sec) return "–";
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} ${t("common.min")}`;
  return `${sec} ${t("common.sec")}`;
}

export function repRange(min?: number, max?: number): string | undefined {
  if (min == null && max == null) return undefined;
  if (min != null && max != null && min !== max) return `${min}–${max}`;
  return String(min ?? max);
}

/** z. B. "4 × 8–10" oder "3 × 40 s" oder "30 Min" – bei „Je Seite“ mit Zusatz: "3 × 8–10 je Seite" */
export function targetSummary(
  trackingType: TrackingType,
  target: Pick<SessionTarget, "sets" | "repMin" | "repMax" | "durationSec" | "perSide">,
  t: Translate,
): string {
  if (trackingType === "cardio") return formatSeconds(target.durationSec, t);
  const suffix = target.perSide ? ` ${t("common.perSide")}` : "";
  if (trackingType === "duration") return `${target.sets} × ${formatSeconds(target.durationSec, t)}${suffix}`;
  const reps = repRange(target.repMin, target.repMax);
  return `${reps ? `${target.sets} × ${reps}` : `${target.sets} ${t("common.sets")}`}${suffix}`;
}

export function exerciseDefaultsSummary(exercise: Exercise, t: Translate): string | undefined {
  if (!exercise.defaultSets && !exercise.defaultDurationSec) return undefined;
  return targetSummary(
    exercise.trackingType,
    {
      sets: exercise.defaultSets ?? 1,
      repMin: exercise.defaultRepMin,
      repMax: exercise.defaultRepMax,
      durationSec: exercise.defaultDurationSec,
    },
    t,
  );
}
