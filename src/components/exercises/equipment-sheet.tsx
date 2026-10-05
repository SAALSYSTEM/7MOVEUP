import { Trash2 } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, settingsRepository } from "@/data";
import type { CustomEquipment, EquipmentKey } from "@/domain/types";
import { useData } from "@/hooks/use-data";
import { CUSTOM_EQUIPMENT_PREFIX, EQUIPMENT_NAME_MAX, cleanEquipmentName, equipmentLabel, findExistingEquipment } from "@/lib/equipment";
import { createId } from "@/lib/id";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Gerät wurde angelegt oder gab es schon → in der Übung auswählen */
  onPick: (key: EquipmentKey) => void;
  /** eigenes Gerät gelöscht → aus der Auswahl der Übung entfernen */
  onDeleted: (key: EquipmentKey) => void;
};

/**
 * Eigenes Gerät einmal anlegen, danach überall wählbar (eigene Übungen, Übungsfilter).
 * Doppelte Namen – auch zu Standardgeräten – werden erkannt und das vorhandene Gerät gewählt.
 * Löschen geht nur, solange keine Übung das Gerät nutzt.
 */
export function EquipmentSheet({ open, onClose, onPick, onDeleted }: Props) {
  const { t, settings } = useApp();
  const toast = useToast();
  const [name, setName] = useState("");
  const custom = settings.customEquipment ?? [];
  const { data: exercises } = useData(() => exerciseRepository.getAll());
  const inUse = new Set((exercises ?? []).flatMap((e) => e.equipment));

  const close = () => {
    setName("");
    onClose();
  };

  const add = async () => {
    const clean = cleanEquipmentName(name);
    if (!clean) return;
    const existing = findExistingEquipment(clean, custom);
    if (existing) {
      onPick(existing);
      toast(t("equipment.exists", { name: equipmentLabel(existing, t, custom) ?? clean }));
      return close();
    }
    const created: CustomEquipment = {
      key: `${CUSTOM_EQUIPMENT_PREFIX}${createId()}`,
      name: clean,
      createdAt: new Date().toISOString(),
    };
    await settingsRepository.update({ customEquipment: [...custom, created] });
    onPick(created.key);
    toast(t("equipment.added", { name: clean }));
    close();
  };

  const remove = async (item: CustomEquipment) => {
    await settingsRepository.update({ customEquipment: custom.filter((c) => c.key !== item.key) });
    onDeleted(item.key);
  };

  return (
    <Sheet open={open} onClose={close} title={t("equipment.sheetTitle")}>
      <form
        className="pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          // Sheet liegt im Portal – React reicht Events trotzdem an umgebende Formulare weiter
          e.stopPropagation();
          void add();
        }}
      >
        <Label htmlFor="own-equipment-name">{t("equipment.name")}</Label>
        <div className="flex gap-2">
          <Input
            id="own-equipment-name"
            value={name}
            maxLength={EQUIPMENT_NAME_MAX}
            placeholder={t("equipment.namePlaceholder")}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={!cleanEquipmentName(name)} className="shrink-0">
            {t("common.add")}
          </Button>
        </div>
        <FieldHint>{t("equipment.sheetHint")}</FieldHint>
      </form>

      {custom.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("equipment.yours")}</p>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {custom.map((item) => (
              <li key={item.key} className="flex min-h-12 items-center justify-between gap-3 py-1 pl-4 pr-1.5">
                <span className="min-w-0 truncate font-semibold">{item.name}</span>
                {inUse.has(item.key) ? (
                  <span className="shrink-0 pr-2.5 text-xs text-subtle">{t("equipment.inUse")}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-white/5 hover:text-danger"
                    aria-label={t("equipment.delete", { name: item.name })}
                  >
                    <Trash2 size={17} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
