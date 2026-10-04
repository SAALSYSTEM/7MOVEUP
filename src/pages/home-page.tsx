import { format, isToday, isTomorrow } from "date-fns";
import { ArrowRight, CalendarClock, CircleCheck, Clock3, Dumbbell, Flame, Play, TrendingUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { MotivationLoop } from "@/components/home/motivation-loop";
import { AppHeader } from "@/components/layout/app-header";
import { Page } from "@/components/layout/page";
import { exerciseCountLabel } from "@/lib/weekdays";
import { Card, SectionTitle } from "@/components/ui/card";
import { exerciseRepository, planRepository, workoutRepository } from "@/data";
import { getDailyQuote } from "@/domain/motivation";
import { countImprovements } from "@/domain/progression";
import { nextPlanned, openPlansToday, plansForDate, sessionsForDate, sessionsThisWeek, weekSummary } from "@/domain/schedule";
import type { WorkoutPlan } from "@/domain/types";
import { useData } from "@/hooks/use-data";
import { useToday } from "@/hooks/use-today";
import { dateLocale, parseDateKey } from "@/lib/dates";
import { startSessionFromPlan } from "@/services/workout-service";

export function HomePage() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const locale = dateLocale(language);
  const today = useToday();
  const quote = getDailyQuote(today);

  const { data } = useData(async () => {
    const [plans, completed, active, exercises] = await Promise.all([
      planRepository.getAll(),
      workoutRepository.getCompletedSessions(),
      workoutRepository.getActiveSession(),
      exerciseRepository.getAll(),
    ]);
    return { plans, completed, active, exercises };
  });

  const plans = data?.plans ?? [];
  const completed = data?.completed ?? [];
  const active = data?.active;
  const openToday = openPlansToday(plans, completed, today);
  const plannedToday = plansForDate(plans, today);
  const doneToday = sessionsForDate(completed, today);
  const summary = weekSummary(plans, completed, today);
  const improvements = countImprovements(completed, sessionsThisWeek(completed, today));
  const next = nextPlanned(plans, completed, today);
  const last = completed.at(-1);
  const hasHistory = completed.length > 0;

  const startPlan = async (plan: WorkoutPlan) => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await startSessionFromPlan(plan);
      navigate(`/training/session/${session.id}`);
    } finally {
      setStarting(false);
    }
  };

  const onStart = () => {
    if (active) return navigate(`/training/session/${active.id}`);
    if (openToday[0]) return void startPlan(openToday[0]);
    navigate("/training?choose=1");
  };

  const relativeDay = (date: Date) =>
    isToday(date) ? t("home.today") : isTomorrow(date) ? t("home.tomorrow") : format(date, "EEEE", { locale });

  return (
    <Page>
      <AppHeader
        left={
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-subtle">
              {format(today, "EEEE", { locale })}
            </p>
            <p className="text-sm font-semibold text-muted">{format(today, language === "de" ? "d. MMMM" : "MMMM d", { locale })}</p>
          </div>
        }
      />

      <section className="relative mb-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#101012] p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <MotivationLoop words={quote} className="relative py-8" />
        <button
          type="button"
          onClick={onStart}
          disabled={starting || !data}
          className="relative mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-base font-black text-black transition hover:bg-accent-light active:scale-[0.99] disabled:opacity-60"
        >
          {active ? <Play size={20} aria-hidden /> : <Dumbbell size={20} aria-hidden />}
          {active ? t("home.continue") : t("home.start")}
          <ArrowRight size={18} aria-hidden />
        </button>
        {active && (
          <p className="relative mt-3 truncate text-center text-xs font-semibold text-muted">{active.planName}</p>
        )}
      </section>

      <section className="mb-5" aria-labelledby="week-title">
        <SectionTitle id="week-title">{t("home.week")}</SectionTitle>
        {hasHistory || summary.plannedCount > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<Flame size={18} aria-hidden />}
              value={
                summary.plannedCount > 0
                  ? `${summary.completedCount} / ${summary.plannedCount}`
                  : String(summary.completedCount)
              }
              label={t("home.workouts")}
            />
            <StatCard
              icon={<Clock3 size={18} aria-hidden />}
              value={hasHistory ? String(summary.minutes) : "–"}
              label={t("home.minutes")}
            />
            <StatCard
              icon={<TrendingUp size={18} aria-hidden />}
              value={hasHistory ? String(improvements) : "–"}
              label={t("home.improvements")}
            />
          </div>
        ) : (
          <Card className="p-4 text-sm leading-relaxed text-muted">{t("home.emptyWeek")}</Card>
        )}
      </section>

      <section className="space-y-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("home.plannedToday")}</span>
            {doneToday.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                <CircleCheck size={14} aria-hidden /> {t("home.doneBadge")}
              </span>
            )}
          </div>
          {plannedToday.length > 0 ? (
            <ul className="space-y-2">
              {plannedToday.map((plan) => {
                const done = doneToday.some((s) => s.planId === plan.id);
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      disabled={done || Boolean(active) || starting}
                      onClick={() => void startPlan(plan)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3 text-left disabled:cursor-default"
                    >
                      <span className="min-w-0">
                        <span className={done ? "block truncate font-bold text-muted line-through" : "block truncate font-bold"}>
                          {plan.name}
                        </span>
                        <span className="block text-xs text-subtle">{exerciseCountLabel(t, plan.items.length)}</span>
                      </span>
                      {done ? (
                        <CircleCheck size={20} className="shrink-0 text-success" aria-label={t("home.doneBadge")} />
                      ) : (
                        <Play size={18} className="shrink-0 text-accent" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{plans.length === 0 ? t("home.noPlans") : t("home.noPlanToday")}</p>
          )}
        </Card>

        {next && !isToday(next.date) && (
          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
              <CalendarClock size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("home.next")}</p>
              <p className="truncate font-bold">
                <span className="text-accent-light">{relativeDay(next.date)}</span> · {next.plan.name}
              </p>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("home.lastWorkout")}</p>
          {last ? (
            <div>
              <p className="truncate font-bold">{last.planName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {format(parseDateKey(last.date), language === "de" ? "EEEE, d. MMMM" : "EEEE, MMMM d", { locale })}
                {last.durationSec ? ` · ${t("home.minutesShort", { count: Math.round(last.durationSec / 60) })}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("home.noHistory")}</p>
          )}
        </Card>
      </section>
    </Page>
  );
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <Card className="p-3">
      <div className="mb-4 text-accent">{icon}</div>
      <div className="tabular text-xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-subtle">{label}</div>
    </Card>
  );
}

export default HomePage;
