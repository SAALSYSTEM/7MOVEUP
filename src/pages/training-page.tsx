import { ChevronRight, LayoutTemplate, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { EmptyState, Page } from "@/components/layout/page";
import { TrainingTabs } from "@/components/training/training-tabs";
import { WeekdayBadges } from "@/components/training/weekday-picker";
import { exerciseCountLabel } from "@/lib/weekdays";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, planRepository, profileRepository, workoutRepository } from "@/data";
import { WORKOUT_TEMPLATES } from "@/data/seed";
import { planKind, plansFromTemplate } from "@/domain/schedule";
import type { WorkoutPlan } from "@/domain/types";
import { useData } from "@/hooks/use-data";
import { useStartPlan } from "@/hooks/use-start-plan";
import { localized } from "@/i18n";
import { cn } from "@/lib/utils";

export function TrainingPage() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const choosing = params.get("choose") === "1";
  const [adopting, setAdopting] = useState(false);
  /** Vorlage, die den aktuellen Plan ersetzen soll (Rückfrage offen) */
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);

  const { data } = useData(async () => {
    const [plans, completed, active, exercises] = await Promise.all([
      planRepository.getAll(),
      workoutRepository.getCompletedSessions(),
      workoutRepository.getActiveSession(),
      exerciseRepository.getAll(),
    ]);
    return { plans, completed, active, exercises };
  });

  const exercisesById = useMemo(() => new Map((data?.exercises ?? []).map((e) => [e.id, e])), [data]);
  const plans = useMemo(() => data?.plans ?? [], [data]);
  const active = data?.active;

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutPlan[]>();
    for (const plan of plans) {
      const key = plan.group ?? "";
      map.set(key, [...(map.get(key) ?? []), plan]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  }, [plans]);

  const { start: startPlan, busy: starting } = useStartPlan();
  const busy = starting || adopting;

  /** Genau ein persönlicher Plan: eine Vorlage ersetzt ihn – absolvierte Trainings bleiben unberührt. */
  const adoptTemplate = async (templateId: string) => {
    const template = WORKOUT_TEMPLATES.find((tpl) => tpl.id === templateId);
    if (!template || busy) return;
    setAdopting(true);
    try {
      const profile = await profileRepository.getCurrent();
      await planRepository.replaceAll(plansFromTemplate(template, language, profile.id));
      setPendingTemplate(null);
      toast(t("training.adopted"));
    } finally {
      setAdopting(false);
    }
  };

  const requestAdopt = (templateId: string) => {
    if (plans.length === 0) void adoptTemplate(templateId);
    else setPendingTemplate(templateId);
  };

  const adoptedTemplates = new Set(plans.map((p) => p.templateId).filter(Boolean));
  const pending = WORKOUT_TEMPLATES.find((tpl) => tpl.id === pendingTemplate);

  // früherer Kalender-Tab → eigene Kalenderseite
  if (params.get("tab") === "calendar") return <Navigate to="/calendar" replace />;

  return (
    <Page>
      <AppHeader left={<PageTitle>{t("training.title")}</PageTitle>} />

      <TrainingTabs value="plan" />

      {active && (
        <button
          type="button"
          onClick={() => navigate(`/training/session/${active.id}`)}
          className="mb-6 flex w-full items-center gap-3 rounded-[20px] border border-accent/40 bg-accent/10 p-4 text-left"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-accent-light">{t("training.activeSession")}</span>
            <span className="block truncate font-bold">{active.planName}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-accent">
            {t("training.continue")} <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      )}

      <div id="panel-plan" role="tabpanel" aria-labelledby="tab-plan">
        {choosing && plans.length > 0 && !active && (
          <p className="mb-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm font-semibold text-muted">
            {t("training.chooseHint")}
          </p>
        )}

        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="mb-0">{t("training.myPlans")}</SectionTitle>
          <Button size="sm" variant="secondary" onClick={() => navigate("/training/plans/new")}>
            <Plus size={16} aria-hidden /> {t("training.newPlan")}
          </Button>
        </div>

        {data && plans.length === 0 ? (
          <EmptyState icon={<LayoutTemplate size={28} aria-hidden />}>{t("training.noPlans")}</EmptyState>
        ) : (
          <div className="space-y-6">
            {groups.map(([group, list]) => (
              <div key={group || "custom"}>
                <p className="mb-2 px-1 text-xs font-bold text-muted">{group || t("training.ungrouped")}</p>
                <ul className="space-y-2">
                  {list.map((plan) => {
                    const kind = planKind(plan, exercisesById);
                    return (
                      <li key={plan.id}>
                        <Card className="flex items-stretch overflow-hidden">
                          <button
                            type="button"
                            onClick={() => navigate(`/training/plans/${plan.id}`)}
                            className="min-w-0 flex-1 p-4 text-left hover:bg-elevated"
                            aria-label={`${t("common.edit")}: ${plan.name}`}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn("h-2 w-2 shrink-0 rounded-full", kind === "cardio" ? "bg-cardio" : "bg-accent")}
                                aria-hidden
                              />
                              <span className="truncate font-bold">{plan.name}</span>
                            </span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
                              <span>{exerciseCountLabel(t, plan.items.length)}</span>
                              <span aria-hidden>·</span>
                              <WeekdayBadges weekdays={plan.weekdays} />
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void startPlan(plan)}
                            disabled={busy || plan.items.length === 0}
                            className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1 border-l border-line text-accent hover:bg-accent/10 disabled:opacity-40"
                            aria-label={`${t("training.startPlan")}: ${plan.name}`}
                          >
                            <Play size={20} fill="currentColor" aria-hidden />
                            <span className="text-[11px] font-bold">{t("training.startPlan")}</span>
                          </button>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <section className="mt-10" aria-labelledby="templates-title">
          <SectionTitle id="templates-title">{t("training.templates")}</SectionTitle>
          <p className="-mt-1 mb-3 text-sm text-muted">{t("training.templatesHint")}</p>
          <ul className="space-y-2">
            {WORKOUT_TEMPLATES.map((template) => {
              const adopted = adoptedTemplates.has(template.id);
              return (
                <li key={template.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{localized(template.name, language)}</p>
                        <p className="mt-0.5 text-xs text-subtle">{t("training.templateDays", { count: template.days.length })}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={adopted ? "outline" : "primary"}
                        disabled={busy}
                        onClick={() => requestAdopt(template.id)}
                      >
                        {adopted ? t("training.adoptAgain") : t("training.adopt")}
                      </Button>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {template.days.map((day) => (
                        <li key={day.name.de} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate text-muted">{localized(day.name, language)}</span>
                          <span className="shrink-0 text-xs text-subtle">{exerciseCountLabel(t, day.items.length)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <ConfirmSheet
        open={Boolean(pending)}
        onClose={() => setPendingTemplate(null)}
        title={t("training.replaceTitle")}
        description={t("training.replaceText", {
          name: pending ? localized(pending.name, language) : "",
          count: plans.length,
        })}
        confirmLabel={t("training.replaceConfirm")}
        destructive
        onConfirm={() => pending && void adoptTemplate(pending.id)}
      />
    </Page>
  );
}
