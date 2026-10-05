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
