import { format, isTomorrow } from "date-fns";
import { ArrowRight, CalendarClock, CalendarDays, CircleCheck, Dumbbell, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { MeasureCardRow } from "@/components/body/measure-card";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { WelcomeCard } from "@/components/home/welcome-card";
import { BackupLine } from "@/components/home/backup-line";
import { MotivationLoop } from "@/components/home/motivation-loop";
import { AppHeader } from "@/components/layout/app-header";
import { Page } from "@/components/layout/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { planRepository, workoutRepository } from "@/data";
import { measureCardsForDate, plannedPerDay, planWeekdays } from "@/domain/measure-plans";
import { getDailyQuote } from "@/domain/motivation";
import { countImprovements } from "@/domain/progression";
import { nextEvent, openPlansToday, plansForDate, sessionsForDate, sessionsThisWeek, todayProgress, weekSummary } from "@/domain/schedule";
import type { MeasurePlan, WorkoutPlan } from "@/domain/types";
import { useBackupExport, useBackupStatus } from "@/hooks/use-backup";
import { useBodyData } from "@/hooks/use-body-data";
import { useData } from "@/hooks/use-data";
import { useToday } from "@/hooks/use-today";
import { dateLocale } from "@/lib/dates";
import { exerciseCountLabel } from "@/lib/weekdays";
import { startSessionFromPlan } from "@/services/workout-service";

/**
 * Heute beantwortet: Was steht jetzt bzw. als Nächstes an?
 * Motivation + Training starten · heute fällig (Training, Messtag) · als Nächstes · Woche kompakt
 * · Kalender öffnen · Backup-Zeile.
 */
export function HomePage() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const locale = dateLocale(language);
  const today = useToday();
  const quote = getDailyQuote(today);
  const body = useBodyData();
  const backup = useBackupStatus();
  const { exportBackup, busy: backupBusy } = useBackupExport();

  const { data } = useData(async () => {
    const [plans, completed, active] = await Promise.all([
      planRepository.getAll(),
      workoutRepository.getCompletedSessions(),
      workoutRepository.getActiveSession(),
    ]);
    return { plans, completed, active };
  });

  const plans = data?.plans ?? [];
  const completed = data?.completed ?? [];
  const active = data?.active;
  const openToday = openPlansToday(plans, completed, today);
  const plannedToday = plansForDate(plans, today);
  const doneToday = sessionsForDate(completed, today);
  const summary = weekSummary(plans, completed, today);
  const improvements = countImprovements(completed, sessionsThisWeek(completed, today));
  const hasHistory = completed.length > 0;

  // Körperwerte heute: eine Karte pro geplantem Messplan (Information, kein Abhaken-Zwang)
  const measurePlans = useMemo(() => body.bodySettings?.plans ?? [], [body.bodySettings]);
  const measureCards = useMemo(
    () => (body.loaded ? measureCardsForDate(measurePlans, body.measurements, today).cards : []),
    [body.loaded, measurePlans, body.measurements, today],
  );
  const [capturePlan, setCapturePlan] = useState<MeasurePlan | undefined>();

  // Fortschritt des Tages über Trainings + Messpläne (ein Plan zählt, wenn die geplante Anzahl erreicht ist)
  const training = todayProgress(plans, completed, today);
  const total = training.total + measureCards.length;
  const done = training.done + measureCards.filter((c) => c.measurements.length >= plannedPerDay(c.plan)).length;
  const dayState = total === 0 ? (training.state === "done" ? "done" : "none") : done === total ? "done" : done > 0 ? "partial" : "none";

  const next = nextEvent(plans, planWeekdays(measurePlans), today);

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

  const relativeDay = (date: Date) => (isTomorrow(date) ? t("home.tomorrow") : format(date, "EEEE", { locale }));
  const hasTodayItems = plannedToday.length > 0 || measureCards.length > 0;

  return (
    <Page>
      <AppHeader
        left={
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-subtle">{format(today, "EEEE", { locale })}</p>
            <p className="text-sm font-semibold text-muted">{format(today, language === "de" ? "d. MMMM" : "MMMM d", { locale })}</p>
          </div>
        }
      />

      <section className="relative mb-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#101012] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
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
        {active && <p className="relative mt-3 truncate text-center text-xs font-semibold text-muted">{active.planName}</p>}
      </section>

      {/* Neu hier? – nur solange es noch kein Training gibt */}
      {data && !hasHistory && <WelcomeCard />}

      {/* Heute fällig */}
      <section className="mb-3" aria-labelledby="today-title">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="today-title" className="text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">
              {t("home.plannedToday")}
            </h2>
            {dayState === "done" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
                <CircleCheck size={14} aria-hidden /> {t("home.doneBadge")}
              </span>
            )}
            {dayState === "partial" && (
              <span className="tabular text-xs font-bold text-muted">{t("home.doneOf", { done, total })}</span>
            )}
          </div>
          {hasTodayItems ? (
            <ul className="space-y-2">
              {plannedToday.map((plan) => {
                const isDone = doneToday.some((s) => s.planId === plan.id);
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      disabled={isDone || Boolean(active) || starting}
                      onClick={() => void startPlan(plan)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3 text-left disabled:cursor-default"
                    >
                      <span className="min-w-0">
                        <span className={isDone ? "block truncate font-bold text-muted line-through" : "block truncate font-bold"}>
                          {plan.name}
                        </span>
                        <span className="block text-xs text-subtle">{exerciseCountLabel(t, plan.items.length)}</span>
                      </span>
                      {isDone ? (
                        <CircleCheck size={20} className="shrink-0 text-success" aria-label={t("home.doneBadge")} />
                      ) : (
                        <Play size={18} className="shrink-0 text-accent" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
              {measureCards.map((card) => (
                <li key={card.plan.id}>
                  <MeasureCardRow
                    card={card}
                    onCapture={() => {
                      setCapturePlan(card.plan);
                      setCaptureOpen(true);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{plans.length === 0 ? t("home.noPlans") : t("home.noPlanToday")}</p>
          )}
        </Card>
      </section>

      {/* Als Nächstes – genau eine Zeile, nie etwas von heute */}
      {next && (
        <Card className="mb-3 flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <CalendarClock size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("home.next")}</p>
            <p className="truncate font-bold">
              <span className="text-accent-light">{relativeDay(next.date)}</span> ·{" "}
              {[...next.trainings.map((p) => p.name), ...(next.measure ? [t("calendar.legendBody")] : [])].join(" · ")}
            </p>
          </div>
        </Card>
      )}

      <div className="mb-6 flex justify-end">
        <Link
          to="/calendar"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-accent-light hover:bg-white/5"
        >
          <CalendarDays size={16} aria-hidden /> {t("home.openCalendar")}
        </Link>
      </div>

      {/* Woche kompakt */}
      <section aria-labelledby="week-title">
        <SectionTitle id="week-title">{t("home.week")}</SectionTitle>
        {hasHistory || summary.plannedCount > 0 ? (
          <Card className="grid grid-cols-3 divide-x divide-line py-3">
            <WeekStat
              value={summary.plannedCount > 0 ? `${summary.completedCount}/${summary.plannedCount}` : String(summary.completedCount)}
              label={t("home.workouts")}
            />
            <WeekStat value={hasHistory ? String(summary.minutes) : "–"} label={t("home.minutes")} />
            <WeekStat value={hasHistory ? String(improvements) : "–"} label={t("home.improvements")} />
          </Card>
        ) : (
          <Card className="p-4 text-sm leading-relaxed text-muted">{t("home.emptyWeek")}</Card>
        )}
      </section>

      {backup.reminder && <BackupLine reminder={backup.reminder} onBackup={() => void exportBackup()} busy={backupBusy} />}

      <MeasurementSheet open={captureOpen} plan={capturePlan} onClose={() => setCaptureOpen(false)} />
    </Page>
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 text-center">
      <div className="tabular text-xl font-black tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-subtle">{label}</div>
    </div>
  );
}

export default HomePage;
