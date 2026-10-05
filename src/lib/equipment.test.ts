import { describe, expect, it } from "vitest";

import type { CustomEquipment } from "@/domain/types";
import { createTranslator } from "@/i18n";

import { allEquipmentKeys, cleanEquipmentName, equipmentLabel, findExistingEquipment } from "./equipment";

const custom: CustomEquipment[] = [{ key: "equip-a", name: "Rudergerät", createdAt: "2026-10-05T18:00:00.000Z" }];

describe("Geräte", () => {
  it("erkennt vorhandene Geräte unabhängig von Schreibweise und Sprache", () => {
    expect(findExistingEquipment("  langhantel ", custom)).toBe("barbell");
    expect(findExistingEquipment("Barbell", custom)).toBe("barbell");
    expect(findExistingEquipment("Ergometer", custom)).toBe("cardio_machine");
    expect(findExistingEquipment("RUDERGERAT", custom)).toBe("equip-a");
    expect(findExistingEquipment("Rudergerät", custom)).toBe("equip-a");
    expect(findExistingEquipment("Slingtrainer", custom)).toBeUndefined();
    expect(findExistingEquipment("   ", custom)).toBeUndefined();
  });

  it("bereinigt Namen und liefert Beschriftungen", () => {
    expect(cleanEquipmentName("  TRX   Band  ")).toBe("TRX Band");
    expect(cleanEquipmentName("x".repeat(60))).toHaveLength(40);
    const t = createTranslator("de");
    expect(equipmentLabel("pullup_bar", t)).toBe("Klimmzugstange");
    expect(equipmentLabel("equip-a", t, custom)).toBe("Rudergerät");
    expect(equipmentLabel("equip-gone", t, custom)).toBeUndefined();
    expect(allEquipmentKeys(custom).at(-1)).toBe("equip-a");
  });
});
