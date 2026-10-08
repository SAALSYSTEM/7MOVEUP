import { format } from "date-fns";
import { Check, Info, Minus, Plus, StickyNote, Timer, TrendingUp } from "lucide-react";

import { useApp } from "@/app/app-context";
import { Card } from "@/components/ui/card";
import { HapticTap } from "@/components/ui/haptic-tap";
import { Stepper } from "@/components/ui/stepper";
import { isProgressionReady, progressionStepKg } from "@/domain/progression";
import { setNumber, usesSides } from "@/domain/sides";
import type { Exercise, PerformanceSnapshot, SessionExercise, SetLog } from "@/domain/types";
import { localized } from "@/i18n";
import { dateLocale, parseDateKey } from "@/lib/dates";
import { equipmentSummary } from "@/lib/equipment";
import { formatKg, targetSummary, usesPerDumbbellWeight, weightUnitLabel } from "@/lib/exercise-format";
import { formatPerformance } from "@/lib/performance-format";
import { cn } from "@/lib/utils";
import { newSetRows } from "@/services/workout-service";

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
  /** Notiz & Videos der Übung im Sheet öffnen */
  onOpenInfo: () => void;
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
  onOpenInfo,
}: Props) {
  const { t, language, settings } = useApp();
  const equipment = exercise ? equipmentSummary(exercise.equipment, t, settings.customEquipment) : undefined;
  const name = localized(entry.name, language);
  const tracking = entry.trackingType;
  const weightLabel = weightUnitLabel(exercise, t);
  const showWeight = tracking === "weight_reps" || (tracking === "duration" && usesPerDumbbellWeight(exercise));
  const doneCount = entry.sets.filter((s) => s.done).length;
  const allDone = doneCount === entry.sets.length && entry.sets.length > 0;
  /** „Je Seite“: Zeilen paarweise (Satz = links + rechts) */
  const perSide = usesSides(entry);
  const sideText = (side: SetLog["side"]) => (side ? t(side === "left" ? "common.left" : "common.right") : "");

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

  const addSet = () => onChange({ ...entry, sets: [...entry.sets, ...newSetRows(entry)] });
  /** bei „Je Seite“ fällt ein ganzer Satz (beide Seiten) weg – nur, wenn noch nichts davon erledigt ist */
  const rowsPerSet = perSide ? 2 : 1;
  const canRemoveSet = entry.sets.length > rowsPerSet && !entry.sets.slice(-rowsPerSet).some((s) => s.done);
  const removeSet = () => {
    if (!canRemoveSet) return;
    onChange({ ...entry, sets: entry.sets.slice(0, entry.sets.length - rowsPerSet) });
  };

  const hasInfo = Boolean(personalNote) || hasVideo;

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
            {equipment && <p className="mt-0.5 text-xs text-subtle">{equipment}</p>}
          </div>
          {exercise && (
            <button
              type="button"
              onClick={onOpenInfo}
              className={cn(
                "relative -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/5",
                hasInfo ? "text-accent" : "text-muted hover:text-fg",
              )}
              aria-label={`${t("session.info")}: ${name}`}
            >
              <Info size={20} aria-hidden />
              {hasInfo && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-card" aria-hidden />}
            </button>
          )}
        </div>

        {(entry.target.note || personalNote) && (
          <div className="mt-3 space-y-1.5">
            {entry.target.note && <p className="text-sm text-muted">{entry.target.note}</p>}
            {personalNote && (
              <button
                type="button"
                onClick={onOpenInfo}
                className="flex w-full items-start gap-2 rounded-xl bg-elevated px-3 py-2 text-left text-sm text-muted"
              >
                <StickyNote size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span className="line-clamp-3 whitespace-pre-line">{personalNote}</span>
              </button>
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
              <p className="tabular mt-0.5 whitespace-pre-line text-[15px] font-semibold text-muted">{lastText.detail}</p>
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
          <CardioInputs
            entry={entry}
            name={name}
            onUpdate={(patch) => updateSet(0, patch)}
            onToggle={() => toggleDone(0)}
            onOpenTimer={() => onOpenTimer(0)}
          />
        ) : (
          <ol className="space-y-1.5">
            {entry.sets.map((set, setIndex) => {
              const number = perSide ? setNumber(setIndex) : setIndex + 1;
              /** z. B. „2 Rechts“ bzw. „Satz 2 Rechts“ für Screenreader und Beschriftungen */
              const numberLabel = `${number}${set.side ? ` ${sideText(set.side)}` : ""}`;
              const rowName = t("session.set", { n: numberLabel });
              return (
              <li
                key={setIndex}
                className={cn(
                  "flex items-center gap-2 rounded-2xl py-1 pl-3 pr-1 transition-colors",
                  set.done ? "bg-success/[0.07]" : "bg-transparent",
                  // etwas mehr Luft zwischen den Sätzen als zwischen den beiden Seiten eines Satzes
                  perSide && setIndex % 2 === 1 && setIndex < entry.sets.length - 1 && "mb-3",
                )}
              >
                <div className={cn("shrink-0", perSide ? "w-14" : "w-12")}>
                  <span className={cn("block text-sm font-bold", set.done ? "text-success" : "text-muted")}>
                    {t("session.set", { n: number })}
                  </span>
                  {set.side ? (
                    <span
                      className={cn(
                        "block text-[10px] font-extrabold uppercase tracking-wider",
                        set.done ? "text-success" : "text-accent-light",
                      )}
                    >
                      {sideText(set.side)}
                    </span>
                  ) : (
                    set.done &&
                    showWeight &&
                    set.weightPerDumbbellKg != null && (
                      <span className="tabular block text-[10px] font-semibold text-subtle">{formatKg(set.weightPerDumbbellKg, language)} kg</span>
                    )
                  )}
                </div>
                {tracking === "duration" ? (
                  <>
                    <Stepper
                      className="flex-1"
                      value={set.durationSec}
                      onChange={(v) => updateSet(setIndex, { durationSec: v })}
                      label={`${t("session.seconds")} ${rowName} · ${name}`}
                      step={5}
                      max={3600}
                    />
                    {perSide && setIndex % 2 === 1 ? (
                      // ein Timer pro Satz (Seite → Wechsel → Seite): der Knopf sitzt in der ersten Zeile des Satzes
                      <span className="h-11 w-11 shrink-0" aria-hidden />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenTimer(setIndex)}
                        disabled={perSide && entry.sets[setIndex].done && entry.sets[setIndex + 1]?.done}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent disabled:opacity-30"
                        aria-label={`${t("session.openTimer", { n: number })} · ${name}`}
                      >
                        <Timer size={19} aria-hidden />
                      </button>
                    )}
                  </>
                ) : (
                  <Stepper
                    className="flex-1"
                    value={set.reps}
                    onChange={(v) => updateSet(setIndex, { reps: v })}
                    label={`${t("session.reps")} ${rowName} · ${name}`}
                    max={500}
                  />
                )}
                <HapticTap className="shrink-0" onTap={() => toggleDone(setIndex)}>
                  <button
                    type="button"
                    onClick={() => toggleDone(setIndex)}
                    aria-pressed={set.done}
                    aria-label={`${set.done ? t("session.markUndone", { n: numberLabel }) : t("session.markDone", { n: numberLabel })} · ${name}`}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      set.done ? "border-success bg-success text-black" : "border-line text-subtle hover:border-muted",
                    )}
                  >
                    <Check size={20} strokeWidth={3} aria-hidden />
                  </button>
                </HapticTap>
              </li>
              );
            })}
          </ol>
        )}

        {tracking !== "cardio" && (
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              onClick={removeSet}
              disabled={!canRemoveSet}
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
  name,
  onUpdate,
  onToggle,
  onOpenTimer,
}: {
  entry: SessionExercise;
  name: string;
  onUpdate: (patch: Partial<SetLog>) => void;
  onToggle: () => void;
  /** Countdown über die eingestellten Minuten – wie bei Zeitübungen */
  onOpenTimer: () => void;
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
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onOpenTimer}
          className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-accent/15 px-4 text-sm font-extrabold text-accent"
          aria-label={`${t("session.openCardioTimer")} · ${name}`}
        >
          <Timer size={18} aria-hidden /> {t("session.timer")}
        </button>
        <HapticTap className="min-w-0 flex-1" onTap={onToggle}>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={set.done}
            className={cn(
              "flex h-12 w-full min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-2 text-sm font-extrabold transition-colors",
              set.done ? "border-success bg-success text-black" : "border-line text-muted hover:text-fg",
            )}
          >
            <Check size={18} strokeWidth={3} aria-hidden />
            {set.done ? t("session.cardioUndone") : t("session.cardioDone")}
          </button>
        </HapticTap>
      </div>
    </div>
  );
}
