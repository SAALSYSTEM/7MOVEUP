import { AnimatePresence } from "framer-motion";
import { ChevronDown, Flag, Info, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { EmptyState, Page } from "@/components/layout/page";
import { RestTimer } from "@/components/training/rest-timer";
import { SessionExerciseCard } from "@/components/training/session-exercise-card";
import { TimerSheet } from "@/components/training/timer-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { NumberField } from "@/components/ui/number-field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, planRepository, workoutRepository } from "@/data";
import type { Exercise, ExerciseNote, PerformanceSnapshot, SessionExercise, WorkoutSession } from "@/domain/types";
import { localized } from "@/i18n";
import { formatDuration } from "@/lib/dates";
import { tick } from "@/services/feedback";
import { finishSession } from "@/services/workout-service";

type Loaded = {
  exercises: Map<string, Exercise>;
  notes: Map<string, ExerciseNote>;
  last: Map<string, PerformanceSnapshot | undefined>;
  planNotes?: string;
};

function useElapsed(startedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
}

export function SessionPage() {
  const { sessionId = "" } = useParams();
  const { t, language } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [context, setContext] = useState<Loaded | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [timerTarget, setTimerTarget] = useState<{ exerciseIndex: number; setIndex: number } | null>(null);
  const [rest, setRest] = useState<{ runId: number; seconds: number; label: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [durationMin, setDurationMin] = useState<number | undefined>();
  const [showPlanNotes, setShowPlanNotes] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<WorkoutSession | null>(null);
  const restRunId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await workoutRepository.getSession(sessionId);
      if (cancelled) return;
      if (!loaded) {
        setNotFound(true);
        return;
      }
      if (loaded.completedAt) {
        navigate("/training?tab=calendar", { replace: true });
        return;
      }
      const ids = Array.from(new Set(loaded.exercises.map((e) => e.exerciseId)));
      const [exercises, notes, lasts, plan] = await Promise.all([
        Promise.all(ids.map((id) => exerciseRepository.getById(id))),
        exerciseRepository.getNotes(),
        Promise.all(ids.map((id) => workoutRepository.getLastPerformance(id, loaded.startedAt))),
        loaded.planId ? planRepository.getById(loaded.planId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      setContext({
        exercises: new Map(exercises.filter((e): e is Exercise => Boolean(e)).map((e) => [e.id, e])),
        notes: new Map(notes.map((n) => [n.exerciseId, n])),
        last: new Map(ids.map((id, i) => [id, lasts[i]])),
        planNotes: plan?.notes,
      });
      sessionRef.current = loaded;
      setSession(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const elapsed = useElapsed(session?.startedAt);

  /** Jede Änderung sofort lokal speichern → Reload/App-Wechsel verliert nichts. */
  const updateExercise = useCallback((index: number, entry: SessionExercise) => {
    const prev = sessionRef.current;
    if (!prev) return;
    const next = { ...prev, exercises: prev.exercises.map((e, i) => (i === index ? entry : e)) };
    sessionRef.current = next;
    setSession(next);
    saveQueue.current = saveQueue.current
      .then(() => workoutRepository.saveSession(next))
      .then(() => undefined)
      .catch(console.error);
  }, []);

  const totals = useMemo(() => {
    const all = session?.exercises.flatMap((e) => e.sets) ?? [];
    return { done: all.filter((s) => s.done).length, total: all.length };
  }, [session]);

  if (notFound) {
    return (
      <Page withNav={false}>
        <EmptyState title={t("session.notFound")} action={<Button onClick={() => navigate("/training")}>{t("training.title")}</Button>} />
      </Page>
    );
  }
  if (!session || !context) return <Page withNav={false} />;

  const timerEntry = timerTarget ? session.exercises[timerTarget.exerciseIndex] : undefined;
  const timerSet = timerEntry && timerTarget ? timerEntry.sets[timerTarget.setIndex] : undefined;

  const startRest = (entry: SessionExercise, setIndex: number) => {
    tick();
    const isLastSetOfExercise = setIndex >= entry.sets.length - 1;
    const isLastExercise = session.exercises.at(-1)?.id === entry.id;
    const seconds = entry.target.restSec ?? 0;
    if (seconds > 0 && !(isLastSetOfExercise && isLastExercise)) {
      restRunId.current += 1;
      setRest({ runId: restRunId.current, seconds, label: localized(entry.name, language) });
    }
  };

  const openFinish = () => {
    setDurationMin(Math.max(1, Math.round(elapsed / 60)));
    setFinishOpen(true);
  };

  const confirmFinish = async () => {
    await saveQueue.current;
    await finishSession(session, (durationMin ?? Math.round(elapsed / 60)) * 60);
    setFinishOpen(false);
    toast(t("session.finished"));
    navigate("/", { replace: true });
  };

  const discard = async () => {
    await saveQueue.current;
    await workoutRepository.deleteSession(session.id);
    setDiscardOpen(false);
    navigate("/training", { replace: true });
  };

  return (
    <Page withNav={false} className="pb-[calc(env(safe-area-inset-bottom)+200px)]">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line/60 bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/training")}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
            aria-label={t("common.close")}
          >
            <X size={22} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black tracking-tight">{session.planName}</h1>
            <p className="tabular text-xs font-semibold text-muted">
              {t("session.elapsed")} {formatDuration(elapsed)} · {t("session.finishSets", { done: totals.done, total: totals.total })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDiscardOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-white/5 hover:text-danger"
            aria-label={t("session.discard")}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%` }}
          />
        </div>
      </header>

      {context.planNotes && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowPlanNotes((v) => !v)}
            aria-expanded={showPlanNotes}
            className="flex w-full items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-left text-sm font-bold"
          >
            <Info size={16} className="text-accent" aria-hidden />
            <span className="flex-1">{t("session.planNotes")}</span>
            <ChevronDown size={16} className={showPlanNotes ? "rotate-180 transition" : "transition"} aria-hidden />
          </button>
          {showPlanNotes && (
            <p className="whitespace-pre-line px-4 pt-2 text-sm leading-relaxed text-muted">{context.planNotes}</p>
          )}
        </div>
      )}

      <ol className="space-y-4">
        {session.exercises.map((entry, index) => {
          const exercise = context.exercises.get(entry.exerciseId);
          const note = context.notes.get(entry.exerciseId);
          return (
            <li key={entry.id}>
              <SessionExerciseCard
                index={index}
                entry={entry}
                exercise={exercise}
                last={context.last.get(entry.exerciseId)}
                personalNote={note?.note?.trim() || undefined}
                hasVideo={Boolean(exercise?.videoUrls?.length || note?.videoUrls?.length)}
                planStepKg={session.progressionStepKg}
                onChange={(next) => updateExercise(index, next)}
                onSetDone={(setIndex) => startRest(entry, setIndex)}
                onOpenTimer={(setIndex) => setTimerTarget({ exerciseIndex: index, setIndex })}
              />
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence>
            {rest && (
              <RestTimer key="rest" runId={rest.runId} seconds={rest.seconds} label={rest.label} onDone={() => setRest(null)} />
            )}
          </AnimatePresence>
          <Button size="lg" className="w-full" onClick={openFinish}>
            <Flag size={18} aria-hidden /> {t("session.finish")}
          </Button>
        </div>
      </div>

      <TimerSheet
        open={Boolean(timerTarget && timerSet)}
        onClose={() => setTimerTarget(null)}
        title={timerEntry ? localized(timerEntry.name, language) : ""}
        subtitle={timerTarget ? t("session.set", { n: timerTarget.setIndex + 1 }) : undefined}
        durationSec={timerSet?.durationSec ?? timerEntry?.target.durationSec ?? 30}
        onComplete={(elapsedSec) => {
          if (!timerTarget || !timerEntry) return;
          const { exerciseIndex, setIndex } = timerTarget;
          const entry = session.exercises[exerciseIndex];
          const alreadyDone = entry.sets[setIndex]?.done;
          updateExercise(exerciseIndex, {
            ...entry,
            sets: entry.sets.map((s, i) =>
              i === setIndex ? { ...s, durationSec: elapsedSec, done: true, completedAt: new Date().toISOString() } : s,
            ),
          });
          if (!alreadyDone) startRest(entry, setIndex);
        }}
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={t("session.finishTitle")}
        description={t("session.finishSets", { done: totals.done, total: totals.total })}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setFinishOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void confirmFinish()}>{t("session.saveFinish")}</Button>
          </div>
        }
      >
        <NumberField label={t("session.durationLabel")} value={durationMin} min={1} max={600} onChange={setDurationMin} className="max-w-[200px]" />
      </Sheet>

      <ConfirmSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t("session.discard")}
        description={t("session.discardConfirm")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void discard()}
      />
    </Page>
  );
}
