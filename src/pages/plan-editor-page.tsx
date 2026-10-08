import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { filterExercises, type ExerciseFilter } from "@/components/exercises/exercise-filter";
import { ExerciseFilters } from "@/components/exercises/exercise-filters";
import { ExerciseRow } from "@/components/exercises/exercise-row";
import { EmptyState, Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { ExerciseInfoSheet } from "@/components/training/exercise-info-sheet";
import { WeekdayPicker } from "@/components/training/weekday-picker";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, planRepository, profileRepository } from "@/data";
import { perSideDefaults } from "@/data/seed";
import { DEFAULT_SWITCH_SEC, MAX_SWITCH_SEC } from "@/domain/sides";
import type { Exercise, WorkoutPlan, WorkoutPlanItem } from "@/domain/types";
import { useData } from "@/hooks/use-data";
import { exerciseName } from "@/i18n";
import { createId } from "@/lib/id";
import { equipmentSummary } from "@/lib/equipment";
import { usesPerDumbbellWeight } from "@/lib/exercise-format";
import { parseSteps } from "@/lib/weight-steps";

function newItem(exercise: Exercise): WorkoutPlanItem {
  return {
    id: createId(),
    exerciseId: exercise.id,
    sets: exercise.trackingType === "cardio" ? 1 : (exercise.defaultSets ?? 3),
    repMin: exercise.defaultRepMin,
    repMax: exercise.defaultRepMax,
    durationSec: exercise.defaultDurationSec,
    restSec: exercise.defaultRestSec,
    // nur für NEU hinzugefügte Übungen – bestehende Planübungen bleiben, wie sie sind
    ...perSideDefaults(exercise),
  };
}

export function PlanEditorPage() {
  const { planId = "new" } = useParams();
  const isNew = planId === "new";
  const { t, language, settings } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: exercises = [] } = useData(() => exerciseRepository.getAll());
  const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  // persönliche Notizen + Videos: auch vorab (am Vortag) ansehen und bearbeiten, nicht nur im Training
  const { data: notes = [], reload: reloadNotes } = useData(() => exerciseRepository.getNotes());
  const notesById = useMemo(() => new Map(notes.map((n) => [n.exerciseId, n])), [notes]);
  const [info, setInfo] = useState<{ exerciseId: string; open: boolean } | null>(null);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [missing, setMissing] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<ExerciseFilter>({ query: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isNew) {
        const profile = await profileRepository.getCurrent();
        const timestamp = new Date().toISOString();
        if (!cancelled)
          setPlan({ id: createId(), profileId: profile.id, name: "", items: [], weekdays: [], createdAt: timestamp, updatedAt: timestamp });
        return;
      }
      const existing = await planRepository.getById(planId);
      if (cancelled) return;
      if (existing) setPlan(existing);
      else setMissing(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, isNew]);

  if (missing) {
    return (
      <Page withNav={false}>
        <SubHeader fallback="/training" />
        <EmptyState title={t("session.notFound")} />
      </Page>
    );
  }
  if (!plan) return <Page withNav={false} />;

  const update = (patch: Partial<WorkoutPlan>) => setPlan((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateItem = (id: string, patch: Partial<WorkoutPlanItem>) =>
    update({ items: plan.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const moveItem = (index: number, direction: -1 | 1) => {
    const items = [...plan.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update({ items });
  };

  const save = async () => {
    if (!plan.name.trim()) {
      setNameError(t("plan.nameRequired"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      await planRepository.save({ ...plan, name: plan.name.trim(), notes: plan.notes?.trim() || undefined });
      toast(t("common.saved"));
      navigate("/training", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await planRepository.delete(plan.id);
    navigate("/training", { replace: true });
  };

  const pickerResults = filterExercises(exercises, pickerFilter, language);

  return (
    <Page withNav={false}>
      <SubHeader title={isNew ? t("plan.newTitle") : t("plan.editTitle")} fallback="/training" />

      <div className="space-y-6">
        <div>
          <Label htmlFor="plan-name">{t("plan.name")}</Label>
          <Input
            id="plan-name"
            value={plan.name}
            placeholder={t("plan.namePlaceholder")}
            aria-invalid={Boolean(nameError)}
            onChange={(e) => {
              update({ name: e.target.value });
              setNameError(undefined);
            }}
          />
          <FieldError>{nameError}</FieldError>
        </div>

        <div>
          <p id="weekdays-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {t("plan.weekdays")}
          </p>
          <WeekdayPicker value={plan.weekdays} onChange={(weekdays) => update({ weekdays })} labelledBy="weekdays-label" />
          <FieldHint>{t("plan.weekdaysHint")}</FieldHint>
        </div>

        <section aria-labelledby="plan-exercises-title">
          <SectionTitle id="plan-exercises-title">
            {t("plan.exercises")} · {plan.items.length}
          </SectionTitle>
          {plan.items.length === 0 ? (
            <EmptyState>{t("plan.noExercises")}</EmptyState>
          ) : (
            <ol className="space-y-3">
              {plan.items.map((item, index) => {
                const exercise = exercisesById.get(item.exerciseId);
                const tracking = exercise?.trackingType ?? "reps";
                const note = notesById.get(item.exerciseId);
                const hasInfo = Boolean(note?.note?.trim() || note?.videoUrls?.length || exercise?.videoUrls?.length);
                const showSteps = tracking === "weight_reps" || (tracking === "duration" && usesPerDumbbellWeight(exercise));
                return (
                  <li key={item.id}>
                    <Card className="p-4">
                      <div className="mb-2">
                        <div className="-mt-3 flex items-center justify-between">
                          <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-black text-muted">
                            {index + 1}
                          </span>
                          <div className="-mr-2 flex shrink-0">
                            {exercise && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className={hasInfo ? "relative text-accent" : "relative"}
                                onClick={() => setInfo({ exerciseId: exercise.id, open: true })}
                                aria-label={`${t("session.info")}: ${exerciseName(exercise, language)}`}
                              >
                                <Info size={18} aria-hidden />
                                {hasInfo && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-card" aria-hidden />}
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={t("plan.moveUp")}>
                              <ArrowUp size={17} aria-hidden />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === plan.items.length - 1}
                              onClick={() => moveItem(index, 1)}
                              aria-label={t("plan.moveDown")}
                            >
                              <ArrowDown size={17} aria-hidden />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="hover:text-danger"
                              onClick={() => update({ items: plan.items.filter((i) => i.id !== item.id) })}
                              aria-label={t("plan.removeItem")}
                            >
                              <Trash2 size={17} aria-hidden />
                            </Button>
                          </div>
                        </div>
                        <p className="font-bold leading-snug">{exercise ? exerciseName(exercise, language) : item.exerciseId}</p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {[t(`tracking.${tracking}`), exercise ? equipmentSummary(exercise.equipment, t, settings.customEquipment) : undefined]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 min-[400px]:grid-cols-4">
                        {tracking !== "cardio" && (
                          <NumberField label={t("common.sets")} value={item.sets} min={1} max={20} onChange={(v) => updateItem(item.id, { sets: v ?? 1 })} />
                        )}
                        {(tracking === "weight_reps" || tracking === "reps") && (
                          <>
                            <NumberField label={t("plan.repMin")} value={item.repMin} max={200} onChange={(v) => updateItem(item.id, { repMin: v })} />
                            <NumberField label={t("plan.repMax")} value={item.repMax} max={200} onChange={(v) => updateItem(item.id, { repMax: v })} />
                          </>
                        )}
                        {tracking === "duration" && (
                          <NumberField label={t("plan.duration")} value={item.durationSec} max={3600} onChange={(v) => updateItem(item.id, { durationSec: v })} />
                        )}
                        {tracking === "duration" && item.perSide && (
                          <NumberField
                            label={t("plan.switchSec")}
                            value={item.switchSec}
                            placeholder={String(DEFAULT_SWITCH_SEC)}
                            max={MAX_SWITCH_SEC}
                            onChange={(v) => updateItem(item.id, { switchSec: v })}
                          />
                        )}
                        {tracking === "cardio" && (
                          <NumberField
                            label={t("plan.durationMin")}
                            value={item.durationSec == null ? undefined : Math.round(item.durationSec / 60)}
                            max={600}
                            onChange={(v) => updateItem(item.id, { durationSec: v == null ? undefined : v * 60 })}
                          />
                        )}
                        {tracking !== "cardio" && (
                          <NumberField label={t("plan.restSec")} value={item.restSec} max={900} onChange={(v) => updateItem(item.id, { restSec: v })} />
                        )}
                      </div>

                      {tracking !== "cardio" && (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <label htmlFor={`per-side-${item.id}`} className="block text-sm font-semibold">
                              {t("plan.perSide")}
                            </label>
                            {item.perSide && (
                              <p id={`per-side-hint-${item.id}`} className="text-xs text-subtle">
                                {t("plan.perSideHint", { total: item.sets * 2 })}
                              </p>
                            )}
                          </div>
                          <Switch
                            id={`per-side-${item.id}`}
                            checked={Boolean(item.perSide)}
                            aria-describedby={item.perSide ? `per-side-hint-${item.id}` : undefined}
                            onCheckedChange={(on) =>
                              updateItem(item.id, {
                                perSide: on || undefined,
                                // Zeitübung: Wechselpause beim Einschalten sichtbar vorbelegen
                                ...(on && tracking === "duration" ? { switchSec: item.switchSec ?? DEFAULT_SWITCH_SEC } : {}),
                              })
                            }
                          />
                        </div>
                      )}

                      {showSteps && (
                        <StepsField
                          id={`steps-${item.id}`}
                          value={item.weightStepsKg}
                          onChange={(weightStepsKg) => updateItem(item.id, { weightStepsKg })}
                          label={`${t("plan.weightSteps")}${usesPerDumbbellWeight(exercise) ? ` · ${t("common.kgPerDumbbell")}` : ""}`}
                          placeholder={t("plan.weightStepsPlaceholder")}
                        />
                      )}

                      <div className="mt-3">
                        <label htmlFor={`note-${item.id}`} className="mb-1.5 block text-[11px] font-semibold text-muted">
                          {t("plan.itemNote")} <span className="text-subtle">({t("common.optional")})</span>
                        </label>
                        <input
                          id={`note-${item.id}`}
                          value={item.note ?? ""}
                          onChange={(e) => updateItem(item.id, { note: e.target.value || undefined })}
                          className="h-11 w-full rounded-xl border border-line bg-elevated px-3 text-[16px] text-fg outline-none focus:border-accent/70"
                        />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
            <Plus size={18} aria-hidden /> {t("plan.addExercise")}
          </Button>
        </section>

        <div>
          <Label htmlFor="plan-notes">
            {t("plan.notes")} <span className="normal-case tracking-normal text-subtle">({t("common.optional")})</span>
          </Label>
          <Textarea
            id="plan-notes"
            value={plan.notes ?? ""}
            placeholder={t("plan.notesPlaceholder")}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>

        <div className="max-w-[220px]">
          <NumberField
            label={`${t("plan.progressionStep")} (kg)`}
            value={plan.progressionStepKg}
            decimal
            max={20}
            onChange={(v) => update({ progressionStepKg: v || undefined })}
          />
          <FieldHint>
            {plan.progressionStepKg
              ? t("plan.progressionStepValue", { kg: String(plan.progressionStepKg).replace(".", language === "de" ? "," : ".") })
              : t("session.progression")}
          </FieldHint>
        </div>

        {!isNew && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden /> {t("plan.delete")}
          </Button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" className="w-full" onClick={() => void save()} disabled={saving}>
            {t("common.save")}
          </Button>
        </div>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t("plan.pickTitle")} tall>
        <ExerciseFilters filter={pickerFilter} onChange={setPickerFilter} exercises={exercises} />
        <ul className="mt-4 space-y-2">
          {pickerResults.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseRow
                exercise={exercise}
                trailing="add"
                onClick={() => {
                  update({ items: [...plan.items, newItem(exercise)] });
                  setPickerOpen(false);
                  toast(t("plan.added", { name: exerciseName(exercise, language) }));
                }}
              />
            </li>
          ))}
        </ul>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("plan.delete")}
        description={t("plan.deleteConfirm")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void remove()}
      />

      <ExerciseInfoSheet
        open={Boolean(info?.open)}
        onClose={() => setInfo((prev) => (prev ? { ...prev, open: false } : prev))}
        exercise={info ? exercisesById.get(info.exerciseId) : undefined}
        note={info ? notesById.get(info.exerciseId) : undefined}
        onChanged={() => void reloadNotes()}
      />
    </Page>
  );
}

function StepsField({
  id,
  value,
  onChange,
  label,
  placeholder,
}: {
  id: string;
  value: number[] | undefined;
  onChange: (value: number[] | undefined) => void;
  label: string;
  placeholder: string;
}) {
  const { language } = useApp();
  const format = (steps: number[] | undefined) =>
    (steps ?? []).map((n) => (language === "de" ? String(n).replace(".", ",") : String(n))).join(language === "de" ? "; " : ", ");
  const [draft, setDraft] = useState(format(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  return (
    <div className="mt-3">
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode="text"
        value={draft}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          onChange(parseSteps(draft));
        }}
        className="tabular h-11 w-full rounded-xl border border-line bg-elevated px-3 text-[16px] text-fg outline-none placeholder:text-subtle focus:border-accent/70"
      />
    </div>
  );
}
