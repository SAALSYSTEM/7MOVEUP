import {
  EQUIPMENT,
  type CustomEquipment,
  type CustomEquipmentKey,
  type Equipment,
  type EquipmentKey,
} from "@/domain/types";
import type { Translate } from "@/i18n";
import { de } from "@/i18n/de";
import { en } from "@/i18n/en";

export const CUSTOM_EQUIPMENT_PREFIX = "equip-";
export const EQUIPMENT_NAME_MAX = 40;

export function isCustomEquipmentKey(key: string): key is CustomEquipmentKey {
  return key.startsWith(CUSTOM_EQUIPMENT_PREFIX);
}

function isBuiltInEquipment(key: string): key is Equipment {
  return (EQUIPMENT as readonly string[]).includes(key);
}

/** Anzeigename; undefined, wenn ein eigenes Gerät nicht (mehr) existiert */
export function equipmentLabel(key: EquipmentKey, t: Translate, custom: CustomEquipment[] = []): string | undefined {
  if (isBuiltInEquipment(key)) return t(`equipment.${key}`);
  return custom.find((c) => c.key === key)?.name;
}

/** Leerzeichen bereinigen, Länge begrenzen */
export function cleanEquipmentName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, EQUIPMENT_NAME_MAX);
}

/** Vergleichsform: Groß/klein, Akzente, ß und Leerzeichen spielen keine Rolle */
function comparable(name: string): string {
  return cleanEquipmentName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[\s/–-]+/g, " ");
}

/**
 * Gibt es dieses Gerät schon – als Standardgerät (deutscher oder englischer Name) oder als eigenes?
 * Verhindert doppelte Bezeichnungen wie „Langhantel“ und „langhantel “.
 */
export function findExistingEquipment(name: string, custom: CustomEquipment[]): EquipmentKey | undefined {
  const wanted = comparable(name);
  if (!wanted) return undefined;
  for (const key of EQUIPMENT) {
    // „Ergometer/Cardio“ gilt auch für „Ergometer“ und „Cardio“
    const labels = [de[`equipment.${key}`], en[`equipment.${key}`]].flatMap((label) => [label, ...label.split("/")]);
    if (labels.some((label) => comparable(label) === wanted)) return key;
  }
  return custom.find((c) => comparable(c.name) === wanted)?.key;
}

/** Alle Geräte in Anzeigereihenfolge: Standardgeräte, dann eigene (nach Anlage) */
export function allEquipmentKeys(custom: CustomEquipment[] = []): EquipmentKey[] {
  return [...EQUIPMENT, ...custom.map((c) => c.key)];
}

/**
 * Kurzform fürs Anzeigen unter dem Übungsnamen („Kurzhanteln, Hantelbank +1“).
 * „Körpergewicht“ allein wird nicht angezeigt (steht sonst unter jeder zweiten Übung).
 */
export function equipmentSummary(
  keys: EquipmentKey[],
  t: Translate,
  custom: CustomEquipment[] = [],
  max = 2,
): string | undefined {
  const labels = keys
    .filter((key) => !(keys.length === 1 && key === "bodyweight"))
    .map((key) => equipmentLabel(key, t, custom))
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return undefined;
  const shown = labels.slice(0, max).join(", ");
  return labels.length > max ? `${shown} +${labels.length - max}` : shown;
}
