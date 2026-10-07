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
import { ArrowRight, Check, ChevronLeft, ChevronRight, Moon, Play } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { useApp } from "@/app/app-context";
import { Card } from "@/components/ui/card";
import { formatMetric, type MetricView } from "@/domain/body";
import { measureCardsForDate, plannedPerDay, planWeekdays } from "@/domain/measure-plans";
import { dayStatus, planKind, type DayStatus } from "@/domain/schedule";
import type { BodyMeasurement, Exercise, MeasurePlan, WorkoutPlan, WorkoutSession } from "@/domain/types";
import { useToday } from "@/hooks/use-today";
import { dateLocale, isoWeekday, localDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { exerciseCountLabel, WEEKDAYS } from "@/lib/weekdays";

type Props = {
  plans: WorkoutPlan[];
  completed: WorkoutSession[];
  exercisesById: Map<string, Exercise>;
  onStart: (plan: WorkoutPlan, date: Date) => void;
  canStart: boolean;
  /** Körperwerte: erfasste Messungen und geplante Messtage */
  measurements?: BodyMeasurement[];
  metrics?: MetricView[];
  measurePlans?: MeasurePlan[];
  /** Erfassung öffnen: aus einem Plan starten oder eine vorhandene Messung bearbeiten */
  onOpenMeasurement?: (date: string, target: { plan?: MeasurePlan; measurement?: BodyMeasurement }) => void;
};

/** Monatskalender (Dark/Orange): Plan- und Erledigt-Status pro Tag, Tap zeigt Details. */
export function CalendarView({
  plans,
  completed,
  exercisesById,
  onStart,
  canStart,
  measurements = [],
  metrics = [],
  measurePlans = [],
  onOpenMeasurement,
}: Props) {
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
  const measuredDays = useMemo(() => new Set(measurements.map((m) => m.date)), [measurements]);
  const selectedKey = localDateKey(selected);
  const measureDays = useMemo(() => planWeekdays(measurePlans), [measurePlans]);
  const measurementSummary = (m: BodyMeasurement) =>
    metrics
      .filter((metric) => typeof m.values[metric.key] === "number")
      .slice(0, 3)
      .map((metric) => `${metric.name} ${formatMetric(metric, m.values[metric.key], language)}`)
      .join(" · ");

  const sessionSummary = (session: WorkoutSession) => {
    const doneSets = session.exercises.reduce((acc, e) => acc + e.sets.filter((x) => x.done).length, 0);
    const minutes = session.durationSec ? `${t("home.minutesShort", { count: Math.round(session.durationSec / 60) })} · ` : "";
    return `${minutes}${doneSets} ${t("common.sets")}`;
  };

  const selectedIsFuture = isAfter(startOfDay(selected), startOfDay(today));

  /** Eine Liste pro Tag: offen oben, erledigt darunter – Training und Körperwerte gleich behandelt */
  type Entry = { key: string; done: boolean; title: string; subtitle: string; action?: ReactNode };
  const entries: Entry[] = [];
  const unmatched = [...selectedStatus.completed];
  for (const plan of selectedStatus.planned) {
    const kind = planKind(plan, exercisesById);
    const at = unmatched.findIndex((s) => s.planId === plan.id);
    const session = at >= 0 ? unmatched.splice(at, 1)[0] : undefined;
    if (session) {
      entries.push({ key: `plan-${plan.id}`, done: true, title: plan.name, subtitle: sessionSummary(session) });
    } else {
      entries.push({
        key: `plan-${plan.id}`,
        done: false,
        title: plan.name,
        subtitle: `${kind === "cardio" ? t("calendar.legendCardio") : t("calendar.legendStrength")} · ${exerciseCountLabel(t, plan.items.length)}`,
        action: !selectedIsFuture && (
          <button
            type="button"
            disabled={!canStart || plan.items.length === 0}
            onClick={() => onStart(plan, selected)}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-extrabold text-black disabled:opacity-40"
          >
            <Play size={15} fill="currentColor" aria-hidden /> {t("calendar.start")}
          </button>
        ),
      });
    }
  }
  // absolvierte Trainings, deren Plantag es nicht mehr gibt
  for (const session of unmatched) {
    entries.push({ key: `session-${session.id}`, done: true, title: session.planName, subtitle: sessionSummary(session) });
  }
  if (onOpenMeasurement) {
    const { cards, free } = measureCardsForDate(measurePlans, measurements, selected);
    const arrow = (label: string, target: { plan?: MeasurePlan; measurement?: BodyMeasurement }) =>
      !selectedIsFuture && (
        <button
          type="button"
          onClick={() => onOpenMeasurement(selectedKey, target)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-accent hover:bg-white/5"
          aria-label={`${label} – ${format(selected, "d. MMMM", { locale })}`}
        >
          <ArrowRight size={18} aria-hidden />
        </button>
      );
    // eine Karte pro geplantem Plan: „3× geplant · bereits 2“
    for (const card of cards) {
      const planned = plannedPerDay(card.plan);
      const count = card.measurements.length;
      const done = count >= planned;
      const title = card.plan.name.trim() || (done ? t("calendar.bodyLogged") : t("body.captureTitle"));
      entries.push({
        key: `plan-measure-${card.plan.id}`,
        done,
        title,
        subtitle:
          count === 0
            ? t("measure.planned", { count: planned })
            : done
              ? t("measure.recorded", { count })
              : `${t("measure.planned", { count: planned })} · ${t("measure.soFar", { count })}`,
        action: arrow(title, { plan: card.plan }),
      });
    }
    // alle übrigen Messungen des Tages (frei erfasst) einzeln
    for (const m of free) {
      const owner = m.planId ? measurePlans.find((p) => p.id === m.planId) : undefined;
      const title = owner?.name.trim() || t("calendar.bodyLogged");
      entries.push({
        key: `measure-${m.id}`,
        done: true,
        title,
        subtitle: [m.time, measurementSummary(m)].filter(Boolean).join(" · "),
        action: arrow(title, { measurement: m }),
      });
    }
  }
  entries.sort((x, y) => Number(x.done) - Number(y.done));

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
            const measured = measuredDays.has(localDateKey(status.date));
            const bodyDay = Boolean(onOpenMeasurement) && (measured || measureDays.includes(isoWeekday(status.date)));
            return (
              <button
                key={status.date.toISOString()}
                type="button"
                onClick={() => setSelected(status.date)}
                aria-pressed={isSelected}
                aria-label={`${format(status.date, language === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d", { locale })} – ${statusLabel(status)}${bodyDay ? ` · ${t("calendar.bodyLogged")}` : ""}`}
                className={cn(
                  "relative flex h-12 items-center justify-center rounded-2xl transition-colors",
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
                {bodyDay && <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-fg" aria-hidden />}
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
          {onOpenMeasurement && (
            <li className="flex items-center gap-1.5">
              <span className="flex h-3 w-3 items-center justify-center" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-fg" />
              </span>
              {t("calendar.legendBody")}
            </li>
          )}
        </ul>
      </Card>

      <section className="mt-5" aria-live="polite">
        <h3 className="mb-3 px-1 text-sm font-black capitalize">
          {format(selected, language === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d", { locale })}
        </h3>

        {entries.length === 0 ? (
          <Card className="flex items-center gap-3 p-4 text-sm text-muted">
            <Moon size={18} className="shrink-0 text-subtle" aria-hidden />
            {t("calendar.rest")}
          </Card>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.key}>
                <Card className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      entry.done ? "bg-success/15 text-success" : "border-2 border-warning/80",
                    )}
                    role="img"
                    aria-label={entry.done ? t("calendar.legendDone") : t("calendar.open")}
                  >
                    {entry.done && <Check size={18} strokeWidth={3} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{entry.title}</p>
                    <p className="truncate text-xs text-subtle">{entry.subtitle}</p>
                  </div>
                  {entry.action}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
