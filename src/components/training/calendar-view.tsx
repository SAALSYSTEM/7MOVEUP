import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getISODay,
  isAfter,
  isSameDay,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { Check, ChevronLeft, ChevronRight, Moon, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { useApp } from "@/app/app-context";
import { Card } from "@/components/ui/card";
import { dayStatus, planKind, type DayStatus } from "@/domain/schedule";
import type { Exercise, WorkoutPlan, WorkoutSession } from "@/domain/types";
import { useToday } from "@/hooks/use-today";
import { dateLocale } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { exerciseCountLabel, WEEKDAYS } from "@/lib/weekdays";

type Props = {
  plans: WorkoutPlan[];
  completed: WorkoutSession[];
  exercisesById: Map<string, Exercise>;
  onStart: (plan: WorkoutPlan, date: Date) => void;
  canStart: boolean;
};

/** Monatskalender (Dark/Orange): Plan- und Erledigt-Status pro Tag, Tap zeigt Details. */
export function CalendarView({ plans, completed, exercisesById, onStart, canStart }: Props) {
  const { t, language } = useApp();
  const locale = dateLocale(language);
  const today = useToday();
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState(() => startOfDay(today));

  const days = useMemo(
    () =>
      eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map((date) =>
        dayStatus(date, plans, completed, exercisesById),
      ),
    [month, plans, completed, exercisesById],
  );
  const leadingBlanks = getISODay(startOfMonth(month)) - 1;
  const selectedStatus = dayStatus(selected, plans, completed, exercisesById);

  const statusLabel = (status: DayStatus) => {
    switch (status.kind) {
      case "done":
        return t("calendar.statusDone");
      case "strength":
        return t("calendar.statusStrength");
      case "cardio":
        return t("calendar.statusCardio");
      default:
        return t("calendar.statusRest");
    }
  };

  const goToday = () => {
    setMonth(startOfMonth(today));
    setSelected(startOfDay(today));
  };

  return (
    <div>
      <Card className="p-3 pb-4">
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
            aria-label={t("calendar.prev")}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="min-w-0 rounded-full px-3 py-2 text-center"
            aria-label={`${format(month, "LLLL yyyy", { locale })} – ${t("calendar.today")}`}
          >
            <span className="block text-base font-black capitalize tracking-tight" aria-live="polite">
              {format(month, "LLLL yyyy", { locale })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
            aria-label={t("calendar.next")}
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center" aria-hidden>
          {WEEKDAYS.map((day) => (
            <div key={day} className="pb-1 text-[11px] font-bold uppercase tracking-wider text-subtle">
              {t(`weekday.${day}`).slice(0, 2)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} aria-hidden />
          ))}
          {days.map((status) => {
            const isTodayCell = isSameDay(status.date, today);
            const isSelected = isSameDay(status.date, selected);
            return (
              <button
                key={status.date.toISOString()}
                type="button"
                onClick={() => setSelected(status.date)}
                aria-pressed={isSelected}
                aria-label={`${format(status.date, language === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d", { locale })} – ${statusLabel(status)}`}
                className={cn(
                  "flex h-12 items-center justify-center rounded-2xl transition-colors",
                  isSelected ? "bg-elevated" : "hover:bg-white/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular",
                    status.kind === "strength" && "bg-accent text-black",
                    status.kind === "cardio" && "bg-cardio/15 text-cardio ring-1 ring-inset ring-cardio/60",
                    status.kind === "done" && "bg-success/15 text-success",
                    status.kind === "rest" && "text-subtle",
                    isTodayCell && "outline outline-2 outline-offset-2 outline-white",
                  )}
                >
                  {format(status.date, "d")}
                  {status.kind === "done" && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-black">
                      <Check size={11} strokeWidth={3.5} aria-hidden />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-muted">
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-accent" aria-hidden /> {t("calendar.legendStrength")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-cardio/15 ring-1 ring-inset ring-cardio/70" aria-hidden /> {t("calendar.legendCardio")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-success text-black" aria-hidden>
              <Check size={8} strokeWidth={4} />
            </span>
            {t("calendar.legendDone")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-line" aria-hidden /> {t("calendar.legendRest")}
          </li>
        </ul>
      </Card>

      <section className="mt-5" aria-live="polite">
        <h3 className="mb-3 px-1 text-sm font-black capitalize">
          {format(selected, language === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d", { locale })}
        </h3>

        {selectedStatus.completed.length === 0 && selectedStatus.planned.length === 0 && (
          <Card className="flex items-center gap-3 p-4 text-sm text-muted">
            <Moon size={18} className="shrink-0 text-subtle" aria-hidden />
            {t("calendar.rest")}
          </Card>
        )}

        {selectedStatus.completed.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("calendar.completed")}</p>
            <ul className="space-y-2">
              {selectedStatus.completed.map((session) => {
                const doneSets = session.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.done).length, 0);
                return (
                  <li key={session.id}>
                    <Card className="flex items-center gap-3 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                        <Check size={18} strokeWidth={3} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{session.planName}</p>
                        <p className="text-xs text-subtle">
                          {session.durationSec ? t("home.minutesShort", { count: Math.round(session.durationSec / 60) }) : ""}
                          {session.durationSec ? " · " : ""}
                          {doneSets} {t("common.sets")}
                        </p>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selectedStatus.planned.length > 0 && (
          <div>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("calendar.planned")}</p>
            <ul className="space-y-2">
              {selectedStatus.planned.map((plan) => {
                const kind = planKind(plan, exercisesById);
                const done = selectedStatus.completed.some((s) => s.planId === plan.id);
                const startable = !done && !isAfter(startOfDay(selected), startOfDay(today));
                return (
                  <li key={plan.id}>
                    <Card className="flex items-center gap-3 p-4">
                      <span
                        className={cn(
                          "h-9 w-1.5 shrink-0 rounded-full",
                          kind === "cardio" ? "bg-cardio" : "bg-accent",
                          done && "bg-success",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate font-bold", done && "text-muted line-through")}>{plan.name}</p>
                        <p className="text-xs text-subtle">
                          {kind === "cardio" ? t("calendar.legendCardio") : t("calendar.legendStrength")} · {exerciseCountLabel(t, plan.items.length)}
                        </p>
                      </div>
                      {startable && (
                        <button
                          type="button"
                          disabled={!canStart || plan.items.length === 0}
                          onClick={() => onStart(plan, selected)}
                          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-extrabold text-black disabled:opacity-40"
                        >
                          <Play size={15} fill="currentColor" aria-hidden /> {t("calendar.start")}
                        </button>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
