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

/** Text für „Letztes Mal“, z. B. „18 kg je Hantel“ + „10 / 10 / 9 / 8“ – bei „Je Seite“ eine Zeile pro Seite */
export function formatPerformance(
  trackingType: TrackingType,
  sets: SetLog[],
  exercise: Pick<Exercise, "equipment"> | undefined,
  t: Translate,
  language: Language,
): PerformanceText {
  const done = sets.filter((s) => s.done);
  const unit = weightUnitLabel(exercise, t);

  /** Werte einer Gruppe von Sätzen als „10 / 10 / 9“ (bzw. „12 × 10 / 14 × 8“, wenn die Gewichte abweichen) */
  const detailOf = (group: SetLog[], mixedWeights = false): string => {
    switch (trackingType) {
      case "weight_reps":
        return group
          .map((s) => (mixedWeights ? `${formatKg(s.weightPerDumbbellKg, language)} × ${s.reps ?? "–"}` : (s.reps ?? "–")))
          .join(" / ");
      case "reps":
        return `${group.map((s) => s.reps ?? "–").join(" / ")} ${t("common.reps")}`;
      case "duration":
        return group.map((s) => durationText(s.durationSec, t)).join(" / ");
      case "cardio":
        return "";
    }
  };

  /** Bei Seiten: „Links 10 / 10 / 9“ und „Rechts 9 / 9 / 8“ als zwei Zeilen */
  const sideLines = (mixedWeights = false): string | undefined => {
    if (!done.some((s) => s.side)) return undefined;
    const lines = (["left", "right"] as const)
      .map((side) => ({ side, group: done.filter((s) => s.side === side) }))
      .filter(({ group }) => group.length > 0)
      .map(({ side, group }) => `${t(side === "left" ? "common.left" : "common.right")} ${detailOf(group, mixedWeights)}`);
    const plain = done.filter((s) => !s.side);
    if (plain.length > 0) lines.push(detailOf(plain, mixedWeights));
    return lines.join("\n");
  };

  switch (trackingType) {
    case "weight_reps": {
      const weights = new Set(done.map((s) => s.weightPerDumbbellKg ?? 0));
      if (weights.size <= 1) {
        const weight = done[0]?.weightPerDumbbellKg;
        return {
          headline: weight ? `${formatKg(weight, language)} ${unit}` : undefined,
          detail: sideLines() ?? detailOf(done),
        };
      }
      return { headline: unit, detail: sideLines(true) ?? detailOf(done, true) };
    }
    case "reps":
      return { detail: sideLines() ?? detailOf(done) };
    case "duration": {
      const weight = done.find((s) => s.weightPerDumbbellKg)?.weightPerDumbbellKg;
      return {
        headline: weight ? `${formatKg(weight, language)} ${unit}` : undefined,
        detail: sideLines() ?? detailOf(done),
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
