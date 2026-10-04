import type { Exercise, Language, SetLog, TrackingType } from "@/domain/types";
import type { Translate } from "@/i18n";

import { formatKg, weightUnitLabel } from "./exercise-format";

export type PerformanceText = { headline?: string; detail: string };

function durationText(sec: number | undefined, t: Translate) {
  if (!sec) return "–";
  if (sec >= 60) {
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return rest ? `${min}:${String(rest).padStart(2, "0")} ${t("common.min")}` : `${min} ${t("common.min")}`;
  }
  return `${sec} ${t("common.sec")}`;
}

/** Text für „Letztes Mal“, z. B. „18 kg je Hantel“ + „10 / 10 / 9 / 8“ */
export function formatPerformance(
  trackingType: TrackingType,
  sets: SetLog[],
  exercise: Pick<Exercise, "equipment"> | undefined,
  t: Translate,
  language: Language,
): PerformanceText {
  const done = sets.filter((s) => s.done);
  const unit = weightUnitLabel(exercise, t);

  switch (trackingType) {
    case "weight_reps": {
      const weights = new Set(done.map((s) => s.weightPerDumbbellKg ?? 0));
      if (weights.size <= 1) {
        const weight = done[0]?.weightPerDumbbellKg;
        return {
          headline: weight ? `${formatKg(weight, language)} ${unit}` : undefined,
          detail: done.map((s) => s.reps ?? "–").join(" / "),
        };
      }
      return {
        headline: unit,
        detail: done.map((s) => `${formatKg(s.weightPerDumbbellKg, language)} × ${s.reps ?? "–"}`).join(" / "),
      };
    }
    case "reps":
      return { detail: `${done.map((s) => s.reps ?? "–").join(" / ")} ${t("common.reps")}` };
    case "duration": {
      const weight = done.find((s) => s.weightPerDumbbellKg)?.weightPerDumbbellKg;
      return {
        headline: weight ? `${formatKg(weight, language)} ${unit}` : undefined,
        detail: done.map((s) => durationText(s.durationSec, t)).join(" / "),
      };
    }
    case "cardio": {
      const s = done[0];
      const parts = [durationText(s?.durationSec, t)];
      if (s?.watts) parts.push(`${s.watts} W`);
      if (s?.rpm) parts.push(`${s.rpm} RPM`);
      if (s?.heartRate) parts.push(`${s.heartRate} bpm`);
      return { detail: parts.join(" · ") };
    }
  }
}
