/**
 * Messpläne: welche Messwerte an welchen Wochentagen, wie oft pro Tag.
 * Ein Plan ist nur eine Planungshilfe – er kontrolliert nichts. Aus Plänen und vorhandenen Messungen
 * entsteht pro Tag je Plan eine Karte („3× geplant · bereits 2“) plus die übrigen, freien Messungen.
 */
import type { BodyMeasurement, MeasurePlan, Weekday } from "@/domain/types";
import { isoWeekday, localDateKey } from "@/lib/dates";

export const MAX_PER_DAY = 5;

/** Alle Wochentage, an denen irgendein Plan misst (sortiert) */
export function planWeekdays(plans: MeasurePlan[]): Weekday[] {
  return [...new Set(plans.flatMap((p) => p.weekdays))].sort() as Weekday[];
}

/** Ein Plan an einem Tag mit den Messungen, die aus ihm gestartet wurden. */
export type MeasureCard = {
  plan: MeasurePlan;
  /** Messungen dieses Tages aus diesem Plan */
  measurements: BodyMeasurement[];
};

export type DayMeasurements = {
  cards: MeasureCard[];
  /** alle übrigen Messungen des Tages (frei erfasst oder aus einem Plan, der an diesem Tag nicht geplant ist) */
  free: BodyMeasurement[];
};

export function plannedPerDay(plan: MeasurePlan): number {
  return Math.max(1, Math.min(MAX_PER_DAY, plan.perDay));
}

/** Pro geplantem Plan des Tages eine Karte; freie Messungen füllen niemals eine Karte. */
export function measureCardsForDate(plans: MeasurePlan[], measurements: BodyMeasurement[], date: Date): DayMeasurements {
  const key = localDateKey(date);
  const weekday = isoWeekday(date);
  const day = measurements.filter((m) => m.date === key);
  const cards = plans
    .filter((p) => p.weekdays.includes(weekday))
    .map((plan): MeasureCard => ({ plan, measurements: day.filter((m) => m.planId === plan.id) }));
  const inCards = new Set(cards.flatMap((c) => c.measurements.map((m) => m.id)));
  return { cards, free: day.filter((m) => !inCards.has(m.id)) };
}

/** Messwerte, die eine Messung aus diesem Plan abfragt (ohne Auswahl = alle aktiven) */
export function planIncludes(plan: Pick<MeasurePlan, "metricKeys"> | undefined, key: string): boolean {
  return !plan?.metricKeys || plan.metricKeys.includes(key);
}
