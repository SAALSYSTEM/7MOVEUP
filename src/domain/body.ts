/**
 * Körperwerte: Katalog der Standard-Messwerte, Auswahl/Reihenfolge, Einheiten.
 *
 * Gespeichert wird immer in einer Basiseinheit (Gewicht kg, Länge cm, %, kcal) und ungerundet.
 * Imperial (lb, in) ist nur Anzeige: umgerechnet und gerundet wird erst beim Darstellen.
 * Nicht umrechenbare Varianten sind getrennte Messwerte (Muskel kg ≠ Muskel %).
 * Eigene Messwerte haben eine freie Einheit und werden nie umgerechnet.
 */
import type { BodySettings, CustomBodyMetric, Language, LocalizedText, UnitSystem } from "@/domain/types";

export type BodyDimension = "mass" | "length" | "percent" | "energy" | "index";

type BuiltInMetric = {
  key: string;
  name: LocalizedText;
  dimension: BodyDimension;
  /** plausibler Bereich in Basiseinheit – außerhalb nur ein Hinweis */
  min: number;
  max: number;
  /** in der Standardvorlage aktiv */
  defaultEnabled: boolean;
};

/** Standardvorlage – Reihenfolge = Startreihenfolge. Neue Einträge nur anhängen, Schlüssel nie ändern. */
export const BUILT_IN_BODY_METRICS: readonly BuiltInMetric[] = [
  { key: "weight", name: { de: "Gewicht", en: "Weight" }, dimension: "mass", min: 20, max: 300, defaultEnabled: true },
  { key: "body_fat", name: { de: "Körperfett", en: "Body fat" }, dimension: "percent", min: 2, max: 75, defaultEnabled: true },
  { key: "body_water", name: { de: "Wasser", en: "Body water" }, dimension: "percent", min: 20, max: 80, defaultEnabled: true },
  { key: "muscle_kg", name: { de: "Muskel (kg)", en: "Muscle (kg)" }, dimension: "mass", min: 10, max: 150, defaultEnabled: true },
  { key: "muscle_pct", name: { de: "Muskel (%)", en: "Muscle (%)" }, dimension: "percent", min: 10, max: 80, defaultEnabled: false },
  { key: "bone", name: { de: "Knochen", en: "Bone mass" }, dimension: "mass", min: 0.5, max: 8, defaultEnabled: true },
  { key: "scale_kcal", name: { de: "kcal (Waage)", en: "kcal (scale)" }, dimension: "energy", min: 500, max: 6000, defaultEnabled: true },
  { key: "bmi", name: { de: "BMI", en: "BMI" }, dimension: "index", min: 10, max: 60, defaultEnabled: true },
  { key: "waist", name: { de: "Bauchumfang", en: "Waist" }, dimension: "length", min: 40, max: 200, defaultEnabled: true },
  { key: "hip", name: { de: "Hüfte", en: "Hips" }, dimension: "length", min: 50, max: 200, defaultEnabled: false },
  { key: "chest", name: { de: "Brust", en: "Chest" }, dimension: "length", min: 50, max: 200, defaultEnabled: false },
  { key: "upper_arm", name: { de: "Oberarm", en: "Upper arm" }, dimension: "length", min: 15, max: 70, defaultEnabled: false },
  { key: "thigh", name: { de: "Oberschenkel", en: "Thigh" }, dimension: "length", min: 30, max: 110, defaultEnabled: false },
];

/** Fortschritt: Standard-Kacheln (Muskel: die aktive Variante) */
export const DEFAULT_KPI_KEYS = ["weight", "body_fat", ["muscle_kg", "muscle_pct"]] as const;

export const CUSTOM_METRIC_PREFIX = "custom-";
export const CUSTOM_STEPS = [0.1, 0.5, 1] as const;

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

type UnitSpec = { unit: string; decimals: number; step: number; factor: number };

/** Anzeige-Einheit je Dimension; factor = Basiseinheit je Anzeigeeinheit */
function unitSpec(dimension: BodyDimension, system: UnitSystem): UnitSpec {
  switch (dimension) {
    case "mass":
      return system === "imperial"
        ? { unit: "lb", decimals: 1, step: 0.2, factor: KG_PER_LB }
        : { unit: "kg", decimals: 1, step: 0.1, factor: 1 };
    case "length":
      return system === "imperial"
        ? { unit: "in", decimals: 2, step: 0.25, factor: CM_PER_IN }
        : { unit: "cm", decimals: 1, step: 0.5, factor: 1 };
    case "percent":
      return { unit: "%", decimals: 1, step: 0.1, factor: 1 };
    case "energy":
      return { unit: "kcal", decimals: 0, step: 10, factor: 1 };
    case "index":
      return { unit: "", decimals: 1, step: 0.1, factor: 1 };
  }
}

function decimalsForStep(step: number) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

/** Ein Messwert, wie die Oberfläche ihn braucht – Anzeige-Einheit bereits aufgelöst. */
export type MetricView = {
  key: string;
  name: string;
  builtIn: boolean;
  enabled: boolean;
  dimension: BodyDimension | "custom";
  /** Anzeige-Einheit ("" = ohne Einheit) */
  unit: string;
  decimals: number;
  /** Schrittweite in Anzeigeeinheit */
  step: number;
  /** Basiseinheit je Anzeigeeinheit */
  factor: number;
  /** plausibler Bereich in Basiseinheit */
  min?: number;
  max?: number;
};

export function toDisplay(metric: Pick<MetricView, "factor">, base: number) {
  return base / metric.factor;
}

export function fromDisplay(metric: Pick<MetricView, "factor">, display: number) {
  return display * metric.factor;
}

export function defaultBodySettings(profileId: string, now = new Date().toISOString()): BodySettings {
  return {
    profileId,
    metrics: BUILT_IN_BODY_METRICS.map((m) => ({ key: m.key, enabled: m.defaultEnabled })),
    custom: [],
    measureWeekdays: [],
    updatedAt: now,
  };
}

/**
 * Bringt gespeicherte Einstellungen auf den aktuellen Katalog: unbekannte Schlüssel fallen weg,
 * später hinzugekommene Standardwerte werden (inaktiv) angehängt, eigene Werte fehlen nie.
 */
export function normalizeBodySettings(settings: BodySettings): BodySettings {
  const known = new Set([...BUILT_IN_BODY_METRICS.map((m) => m.key), ...settings.custom.map((c) => c.key)]);
  const seen = new Set<string>();
  const metrics = settings.metrics.filter((m) => {
    if (!known.has(m.key) || seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });
  for (const m of BUILT_IN_BODY_METRICS) if (!seen.has(m.key)) metrics.push({ key: m.key, enabled: false });
  for (const c of settings.custom) if (!seen.has(c.key)) metrics.push({ key: c.key, enabled: true });
  return { ...settings, metrics };
}

function customView(custom: CustomBodyMetric, enabled: boolean): MetricView {
  return {
    key: custom.key,
    name: custom.name,
    builtIn: false,
    enabled,
    dimension: "custom",
    unit: custom.unit,
    decimals: decimalsForStep(custom.step),
    step: custom.step,
    factor: 1,
  };
}

/** Alle Messwerte in Nutzer-Reihenfolge (auch inaktive), Einheiten für das gewählte System. */
export function resolveMetrics(settings: BodySettings, language: Language, system: UnitSystem): MetricView[] {
  const normalized = normalizeBodySettings(settings);
  const customByKey = new Map(normalized.custom.map((c) => [c.key, c]));
  return normalized.metrics.flatMap(({ key, enabled }): MetricView[] => {
    const builtIn = BUILT_IN_BODY_METRICS.find((m) => m.key === key);
    if (builtIn) {
      const spec = unitSpec(builtIn.dimension, system);
      return [
        {
          key,
          name: builtIn.name[language],
          builtIn: true,
          enabled,
          dimension: builtIn.dimension,
          unit: spec.unit,
          decimals: spec.decimals,
          step: spec.step,
          factor: spec.factor,
          min: builtIn.min,
          max: builtIn.max,
        },
      ];
    }
    const custom = customByKey.get(key);
    return custom ? [customView(custom, enabled)] : [];
  });
}

/** Die drei Kacheln in Fortschritt (Standard: Gewicht, Körperfett, Muskel) – fehlende werden aufgefüllt. */
export function kpiMetrics(metrics: MetricView[]): MetricView[] {
  const active = metrics.filter((m) => m.enabled);
  const picked: MetricView[] = [];
  for (const entry of DEFAULT_KPI_KEYS) {
    const keys: readonly string[] = typeof entry === "string" ? [entry] : entry;
    const found = keys.map((k) => active.find((m) => m.key === k)).find(Boolean);
    if (found) picked.push(found);
  }
  for (const m of active) {
    if (picked.length >= 3) break;
    if (!picked.includes(m)) picked.push(m);
  }
  return picked.slice(0, 3);
}

export function roundTo(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function formatNumber(value: number, decimals: number, language: Language) {
  return new Intl.NumberFormat(language === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Basiswert → Text mit Einheit, z. B. "75,3 kg" bzw. "166.0 lb" */
export function formatMetric(metric: MetricView, base: number, language: Language, { signed = false } = {}) {
  const display = roundTo(toDisplay(metric, base), metric.decimals);
  const text = formatNumber(Math.abs(display), metric.decimals, language);
  const sign = signed ? (display > 0 ? "+" : display < 0 ? "−" : "±") : display < 0 ? "−" : "";
  const unit = metric.unit ? (metric.unit === "%" ? " %" : ` ${metric.unit}`) : "";
  return `${sign}${text}${unit}`;
}

/** Text der Eingabe (Komma oder Punkt) → Zahl in Anzeigeeinheit */
export function parseDisplayInput(text: string): number | undefined {
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export type ValueCheck = "ok" | "unusual" | "invalid";

/** Hart ungültig: keine Zahl, negativ, Prozent über 100. Ungewöhnlich: außerhalb des plausiblen Bereichs. */
export function checkValue(metric: MetricView, base: number): ValueCheck {
  if (!Number.isFinite(base) || base < 0) return "invalid";
  if (metric.dimension === "percent" && base > 100) return "invalid";
  if (metric.min !== undefined && metric.max !== undefined && (base < metric.min || base > metric.max)) return "unusual";
  return "ok";
}
