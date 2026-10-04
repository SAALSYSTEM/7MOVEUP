import { format } from "date-fns";
import { Check, Minus, Plus, StickyNote, Timer, TrendingUp, Video } from "lucide-react";
import { Link } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { Card } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper";
import { isProgressionReady, progressionStepKg } from "@/domain/progression";
import type { Exercise, PerformanceSnapshot, SessionExercise, SetLog } from "@/domain/types";
import { localized } from "@/i18n";
import { dateLocale, parseDateKey } from "@/lib/dates";
import { formatKg, targetSummary, usesPerDumbbellWeight, weightUnitLabel } from "@/lib/exercise-format";
import { formatPerformance } from "@/lib/performance-format";
import { cn } from "@/lib/utils";
import { emptySet } from "@/services/workout-service";

type Props = {
  index: number;
  entry: SessionExercise;
  exercise: Exercise | undefined;
  last: PerformanceSnapshot | undefined;
  personalNote?: string;
  hasVideo: boolean;
  planStepKg?: number;
  onChange: (entry: SessionExercise) => void;
  onSetDone: (setIndex: number) => void;
  onOpenTimer: (setIndex: number) => void;
};

export function SessionExerciseCard({
  index,
  entry,
  exercise,
  last,
  personalNote,
  hasVideo,
  planStepKg,
  onChange,
  onSetDone,
  onOpenTimer,
}: Props) {
  const { t, language } = useApp();
  const name = localized(entry.name, language);
  const tracking = entry.trackingType;
  const weightLabel = weightUnitLabel(exercise, t);
  const showWeight = tracking === "weight_reps" || (tracking === "duration" && usesPerDumbbellWeight(exercise));
  const doneCount = entry.sets.filter((s) => s.done).length;
  const allDone = doneCount === entry.sets.length && entry.sets.length > 0;

  const ready = isProgressionReady(last);
  const stepKg = ready ? progressionStepKg(last, planStepKg) : undefined;
  const lastText = last ? formatPerformance(last.trackingType, last.sets, exercise, t, language) : undefined;

  const openSets = entry.sets.filter((s) => !s.done);
  const currentWeight = (openSets[0] ?? entry.sets.at(-1))?.weightPerDumbbellKg;

  const updateSet = (setIndex: number, patch: Partial<SetLog>) =>
    onChange({ ...entry, sets: entry.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) });

  /** Gewicht gilt für alle noch offenen Sätze; abgehakte behalten ihr Gewicht. */
  const setWeight = (value: number | undefined) =>
    onChange({ ...entry, sets: entry.sets.map((s) => (s.done ? s : { ...s, weightPerDumbbellKg: value })) });

  const toggleDone = (setIndex: number) => {
    const set = entry.sets[setIndex];
    if (set.done) {
      updateSet(setIndex, { done: false, completedAt: undefined });
    } else {
      updateSet(setIndex, { done: true, completedAt: new Date().toISOString() });
      onSetDone(setIndex);
    }
  };

  const addSet = () => onChange({ ...entry, sets: [...entry.sets, emptySet(entry)] });
  const removeSet = () => {
    const lastIndex = entry.sets.length - 1;
    if (lastIndex < 1 || entry.sets[lastIndex].done) return;
    onChange({ ...entry, sets: entry.sets.slice(0, lastIndex) });
  };

  const detailHref = `/exercises/${encodeURIComponent(entry.exerciseId)}`;

  return (
    <Card className={cn("overflow-hidden transition-colors", allDone && "border-success/40")}>
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
              allDone ? "bg-success text-black" : "bg-elevated text-muted",
            )}
            aria-hidden
          >
            {allDone ? <Check size={15} strokeWidth={3} /> : index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-black leading-snug tracking-tight">{name}</h2>
            <p className="tabular mt-0.5 text-sm font-semibold text-accent-light">
              {targetSummary(tracking, entry.target, t)}
              {entry.target.restSec ? (
                <span className="font-medium text-subtle"> · {t("session.restHint", { sec: entry.target.restSec })}</span>
              ) : null}
            </p>
          </div>
          {hasVideo && (
            <Link
              to={detailHref}
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
              aria-label={`${t("exercise.openVideo")}: ${name}`}
            >
              <Video size={19} aria-hidden />
            </Link>
          )}
        </div>

        {(entry.target.note || personalNote) && (
          <div className="mt-3 space-y-1.5">
            {entry.target.note && <p className="text-sm text-muted">{entry.target.note}</p>}
            {personalNote && (
              <Link to={detailHref} className="flex items-start gap-2 rounded-xl bg-elevated px-3 py-2 text-sm text-muted">
                <StickyNote size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span className="line-clamp-3 whitespace-pre-line">{personalNote}</span>
              </Link>
            )}
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-line/80 bg-bg/40 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">
              {t("session.lastTime")}
              {last && (
                <span className="ml-1 normal-case tracking-normal">
                  · {format(parseDateKey(last.date), language === "de" ? "d. MMM" : "MMM d", { locale: dateLocale(language) })}
                </span>
              )}
            </p>
            {ready && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-bold text-success">
                <TrendingUp size={12} aria-hidden />
                {stepKg ? t("session.progressionKg", { kg: formatKg(stepKg, language) }) : t("session.progression")}
              </span>
            )}
          </div>
          {lastText ? (
            <>
              {lastText.headline && <p className="mt-1 text-[15px] font-bold">{lastText.headline}</p>}
              <p className="tabular mt-0.5 text-[15px] font-semibold text-muted">{lastText.detail}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-subtle">{t("session.firstTime")}</p>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-[#131315] px-4 pb-4 pt-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-subtle">{t("session.today")}</p>

        {showWeight && (
          <div className="mb-3">
            <Stepper
              value={currentWeight}
              onChange={setWeight}
              label={`${t("session.weight")} ${name}`}
              decimal
              step={1}
              max={500}
              unit={weightLabel}
              size="lg"
              disabled={openSets.length === 0}
            />
            {entry.target.weightStepsKg && entry.target.weightStepsKg.length > 0 && openSets.length > 0 && (
              <div className="scrollbar-none -mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label={t("session.weightSteps")}>
                {entry.target.weightStepsKg.map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => setWeight(kg)}
                    aria-pressed={currentWeight === kg}
                    className={cn(
                      "tabular h-9 shrink-0 rounded-full border px-3 text-xs font-bold",
                      currentWeight === kg ? "border-accent bg-accent/15 text-accent-light" : "border-line text-muted",
                    )}
                  >
                    {formatKg(kg, language)} kg
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tracking === "cardio" ? (
          <CardioInputs entry={entry} onUpdate={(patch) => updateSet(0, patch)} onToggle={() => toggleDone(0)} />
        ) : (
          <ol className="space-y-1.5">
            {entry.sets.map((set, setIndex) => (
              <li
                key={setIndex}
                className={cn(
                  "flex items-center gap-2 rounded-2xl py-1 pl-3 pr-1 transition-colors",
                  set.done ? "bg-success/[0.07]" : "bg-transparent",
                )}
              >
                <div className="w-12 shrink-0">
                  <span className={cn("block text-sm font-bold", set.done ? "text-success" : "text-muted")}>
                    {t("session.set", { n: setIndex + 1 })}
                  </span>
                  {set.done && showWeight && set.weightPerDumbbellKg != null && (
                    <span className="tabular block text-[10px] font-semibold text-subtle">{formatKg(set.weightPerDumbbellKg, language)} kg</span>
                  )}
                </div>
                {tracking === "duration" ? (
                  <>
                    <Stepper
                      className="flex-1"
                      value={set.durationSec}
                      onChange={(v) => updateSet(setIndex, { durationSec: v })}
                      label={`${t("session.seconds")} ${t("session.set", { n: setIndex + 1 })} · ${name}`}
                      step={5}
                      max={3600}
                    />
                    <button
                      type="button"
                      onClick={() => onOpenTimer(setIndex)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                      aria-label={`${t("session.openTimer", { n: setIndex + 1 })} · ${name}`}
                    >
                      <Timer size={19} aria-hidden />
                    </button>
                  </>
                ) : (
                  <Stepper
                    className="flex-1"
                    value={set.reps}
                    onChange={(v) => updateSet(setIndex, { reps: v })}
                    label={`${t("session.reps")} ${t("session.set", { n: setIndex + 1 })} · ${name}`}
                    max={500}
                  />
                )}
                <button
                  type="button"
                  onClick={() => toggleDone(setIndex)}
                  aria-pressed={set.done}
                  aria-label={`${set.done ? t("session.markUndone", { n: setIndex + 1 }) : t("session.markDone", { n: setIndex + 1 })} · ${name}`}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    set.done ? "border-success bg-success text-black" : "border-line text-subtle hover:border-muted",
                  )}
                >
                  <Check size={20} strokeWidth={3} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        )}

        {tracking !== "cardio" && (
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              onClick={removeSet}
              disabled={entry.sets.length <= 1 || Boolean(entry.sets.at(-1)?.done)}
              className="inline-flex h-10 items-center gap-1 rounded-xl px-2 text-xs font-bold text-subtle hover:text-fg disabled:opacity-30"
            >
              <Minus size={14} aria-hidden /> {t("session.removeSet")}
            </button>
            <button
              type="button"
              onClick={addSet}
              className="inline-flex h-10 items-center gap-1 rounded-xl px-2 text-xs font-bold text-muted hover:text-fg"
            >
              <Plus size={14} aria-hidden /> {t("session.addSet")}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function CardioInputs({
  entry,
  onUpdate,
  onToggle,
}: {
  entry: SessionExercise;
  onUpdate: (patch: Partial<SetLog>) => void;
  onToggle: () => void;
}) {
  const { t } = useApp();
  const set = entry.sets[0];
  if (!set) return null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 pb-2">
        <Stepper
          value={set.durationSec == null ? undefined : Math.round(set.durationSec / 60)}
          onChange={(v) => onUpdate({ durationSec: v == null ? undefined : v * 60 })}
          label={t("session.minutes")}
          unit={t("session.minutes")}
          max={600}
        />
        <Stepper value={set.watts} onChange={(v) => onUpdate({ watts: v })} label={t("session.watts")} unit={t("session.watts")} step={5} max={2000} />
        <Stepper value={set.rpm} onChange={(v) => onUpdate({ rpm: v })} label={t("session.rpm")} unit={t("session.rpm")} max={250} />
        <Stepper value={set.heartRate} onChange={(v) => onUpdate({ heartRate: v })} label={t("session.heartRate")} unit={t("session.heartRate")} max={250} />
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.done}
        className={cn(
          "mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 text-sm font-extrabold transition-colors",
          set.done ? "border-success bg-success text-black" : "border-line text-muted hover:text-fg",
        )}
      >
        <Check size={18} strokeWidth={3} aria-hidden />
        {set.done ? t("session.cardioUndone") : t("session.cardioDone")}
      </button>
    </div>
  );
}
