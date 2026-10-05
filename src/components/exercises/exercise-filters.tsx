import { Search, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useApp } from "@/app/app-context";
import { Chip } from "@/components/ui/chip";
import { BODY_REGIONS, TRACKING_TYPES, type BodyRegion, type EquipmentKey, type Exercise, type TrackingType } from "@/domain/types";
import { allEquipmentKeys, equipmentLabel } from "@/lib/equipment";

import type { ExerciseFilter } from "./exercise-filter";

type Props = {
  filter: ExerciseFilter;
  onChange: (filter: ExerciseFilter) => void;
  /** alle Übungen: Als Geräte-Filter erscheinen nur Geräte, die mindestens eine Übung nutzt (auch eigene) */
  exercises: Exercise[];
};

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{label}</p>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  );
}

export function ExerciseFilters({ filter, onChange, exercises }: Props) {
  const { t, settings } = useApp();
  const customEquipment = settings.customEquipment ?? [];
  const usedEquipment = useMemo(() => new Set<EquipmentKey>(exercises.flatMap((e) => e.equipment)), [exercises]);
  const set = (patch: Partial<ExerciseFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
        <label htmlFor="exercise-search" className="sr-only">
          {t("common.search")}
        </label>
        <input
          id="exercise-search"
          type="search"
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder={t("exercises.searchPlaceholder")}
          className="h-12 w-full rounded-2xl border border-line bg-card pl-11 pr-11 text-[16px] text-fg placeholder:text-subtle outline-none focus:border-accent/70"
        />
        {filter.query && (
          <button
            type="button"
            onClick={() => set({ query: "" })}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            aria-label={t("exercises.resetFilters")}
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <ChipRow label={t("exercises.region")}>
        <Chip active={!filter.region} onClick={() => set({ region: undefined })}>
          {t("common.all")}
        </Chip>
        {BODY_REGIONS.map((region: BodyRegion) => (
          <Chip key={region} active={filter.region === region} onClick={() => set({ region: filter.region === region ? undefined : region })}>
            {t(`region.${region}`)}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label={t("exercises.equipment")}>
        <Chip active={!filter.equipment} onClick={() => set({ equipment: undefined })}>
          {t("common.all")}
        </Chip>
        {allEquipmentKeys(customEquipment)
          .filter((equipment) => usedEquipment.has(equipment) || filter.equipment === equipment)
          .map((equipment: EquipmentKey) => (
            <Chip
              key={equipment}
              active={filter.equipment === equipment}
              onClick={() => set({ equipment: filter.equipment === equipment ? undefined : equipment })}
            >
              {equipmentLabel(equipment, t, customEquipment)}
            </Chip>
          ))}
      </ChipRow>

      <ChipRow label={t("exercises.tracking")}>
        <Chip active={!filter.tracking} onClick={() => set({ tracking: undefined })}>
          {t("common.all")}
        </Chip>
        {TRACKING_TYPES.map((tracking: TrackingType) => (
          <Chip
            key={tracking}
            active={filter.tracking === tracking}
            onClick={() => set({ tracking: filter.tracking === tracking ? undefined : tracking })}
          >
            {t(`tracking.${tracking}`)}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}
