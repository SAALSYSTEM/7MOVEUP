/**
 * Messpläne: welche Messwerte an welchen Wochentagen, wie oft pro Tag.
 * Aus Plänen und vorhandenen Messungen entstehen die Einträge eines Tages (offen/erledigt).
 */
import type { BodyMeasurement, MeasurePlan, Weekday } from "@/domain/types";
import { isoWeekday, localDateKey } from "@/lib/dates";

export const MAX_PER_DAY = 5;

/** Alle Wochentage, an denen irgendein Plan misst (sortiert) */
export function planWeekdays(plans: MeasurePlan[]): Weekday[] {
  return [...new Set(plans.flatMap((p) => p.weekdays))].sort() as Weekday[];
}

/** Ein Eintrag eines Tages: ein Zeitfenster eines Plans – oder eine freie Messung ohne Plan. */
export type MeasureEntry = {
  key: string;
  planId?: string;
  /** Plan-Name; leer = Standardname („Körperwerte“) */
  name: string;
  slot: number;
  slots: number;
  /** Messwerte des Plans; fehlt = alle aktiven */
  metricKeys?: string[];
  measurement?: BodyMeasurement;
};

/** Anzeigename: „Blutdruck“ bzw. „Blutdruck 2/3“ */
export function entryTitle(entry: Pick<MeasureEntry, "name" | "slot" | "slots">, fallback: string): string {
  const name = entry.name.trim() || fallback;
  return entry.slots > 1 ? `${name} ${entry.slot + 1}/${entry.slots}` : name;
}

/**
 * Einträge eines Tages: pro Plan und Zeitfenster einer. Eine Messung gehört zum Eintrag mit gleichem
 * Plan und Zeitfenster; Messungen ohne Plan (ältere Daten, „Jetzt messen“) füllen der Reihe nach die
 * ersten offenen Einträge. Was übrig bleibt, steht als eigener, erledigter Eintrag da.
 */
export function measureEntriesForDate(plans: MeasurePlan[], measurements: BodyMeasurement[], date: Date): MeasureEntry[] {
  const key = localDateKey(date);
  const weekday = isoWeekday(date);
  const dayMeasurements = measurements.filter((m) => m.date === key);
  const used = new Set<string>();

  const entries: MeasureEntry[] = plans
    .filter((p) => p.weekdays.includes(weekday))
    .flatMap((plan) =>
      Array.from({ length: Math.max(1, Math.min(MAX_PER_DAY, plan.perDay)) }, (_, slot): MeasureEntry => {
        const found = dayMeasurements.find((m) => m.planId === plan.id && (m.slot ?? 0) === slot && !used.has(m.id));
        if (found) used.add(found.id);
        return {
          key: `${plan.id}-${slot}`,
          planId: plan.id,
          name: plan.name,
          slot,
          slots: Math.max(1, Math.min(MAX_PER_DAY, plan.perDay)),
          metricKeys: plan.metricKeys,
          measurement: found,
        };
      }),
    );

  // freie Messungen füllen offene Einträge
  for (const m of dayMeasurements) {
    if (used.has(m.id) || m.planId) continue;
    const open = entries.find((e) => !e.measurement);
    if (!open) continue;
    open.measurement = m;
    used.add(m.id);
  }
  // Rest: eigener Eintrag (ohne Plan bzw. Plan nicht mehr an diesem Tag)
  for (const m of dayMeasurements) {
    if (used.has(m.id)) continue;
    const plan = m.planId ? plans.find((p) => p.id === m.planId) : undefined;
    entries.push({ key: `m-${m.id}`, planId: plan?.id, name: plan?.name ?? "", slot: m.slot ?? 0, slots: 1, measurement: m });
  }
  return entries;
}
