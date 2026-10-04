import { useApp } from "@/app/app-context";
import type { Weekday } from "@/domain/types";
import { WEEKDAYS } from "@/lib/weekdays";
import { cn } from "@/lib/utils";

export function WeekdayBadges({ weekdays }: { weekdays: Weekday[] }) {
  const { t } = useApp();
  if (weekdays.length === 0) return <span>{t("training.unscheduled")}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {[...weekdays].sort().map((day) => (
        <span key={day} className="rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-bold text-muted">
          {t(`weekday.${day}`)}
        </span>
      ))}
    </span>
  );
}

export function WeekdayPicker({ value, onChange, labelledBy }: { value: Weekday[]; onChange: (value: Weekday[]) => void; labelledBy?: string }) {
  const { t } = useApp();
  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-labelledby={labelledBy}>
      {WEEKDAYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((d) => d !== day) : [...value, day].sort())}
            className={cn(
              "flex h-11 items-center justify-center rounded-xl border text-[13px] font-bold transition-colors",
              active ? "border-accent bg-accent text-black" : "border-line bg-elevated text-muted hover:text-fg",
            )}
          >
            {t(`weekday.${day}`)}
          </button>
        );
      })}
    </div>
  );
}
