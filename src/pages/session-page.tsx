import { AnimatePresence } from "framer-motion";
import { ChevronDown, Flag, Info, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { EmptyState, Page } from "@/components/layout/page";
import { ExerciseInfoSheet } from "@/components/training/exercise-info-sheet";
import { RestTimer } from "@/components/training/rest-timer";
import { SessionExerciseCard } from "@/components/training/session-exercise-card";
import { SideTimerSheet, type SideTimerInfo } from "@/components/training/side-timer-sheet";
import { TimerSheet } from "@/components/training/timer-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { NumberField } from "@/components/ui/number-field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, planRepository, workoutRepository } from "@/data";
import type { Exercise, ExerciseNote, PerformanceSnapshot, SessionExercise, SessionTimers, WorkoutSession } from "@/domain/types";
import { localized } from "@/i18n";
import { useWakeLock } from "@/hooks/use-countdown";
import { formatDuration } from "@/lib/dates";
import { dismissKeyboard } from "@/lib/viewport";
import { tick, unlockAudio } from "@/services/feedback";
import { restoreTimers, type TimerResume } from "@/domain/active-session";
import { REQUIRED_SESSIONS } from "@/domain/progression";
import { markSidesDone, openRows, type SideResult } from "@/domain/side-sequence";
import { countSets, isPairDone, partnerIndex, usesSides } from "@/domain/sides";
import type { CountdownSnapshot } from "@/hooks/use-countdown";
import { finishSession } from "@/services/workout-service";

type Loaded = {
  exercises: Map<string, Exercise>;
  notes: Map<string, ExerciseNote>;
  /** die letzten Einheiten je Übung, neueste zuerst (höchstens zwei – für Vorbelegung und Progressionshinweis) */
  recent: Map<string, PerformanceSnapshot[]>;
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
  /** `sequence`: „Je Seite“-Zeitsatz (Seite → Wechsel → Seite → Satzpause in einem Timer), `setIndex` = erste Zeile des Satzes */
  const [timerTarget, setTimerTarget] = useState<{
    exerciseIndex: number;
    setIndex: number;
    resume?: TimerResume;
    sequence?: { rows: number[]; restSec: number };
  } | null>(null);
  const [rest, setRest] = useState<{ runId: number; seconds: number; label: string; endAt?: number } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [durationMin, setDurationMin] = useState<number | undefined>();
  const [showPlanNotes, setShowPlanNotes] = useState(false);
  /** Info-Sheet: Übung bleibt gesetzt, solange das Sheet ausblendet */
  const [info, setInfo] = useState<{ exerciseId: string; open: boolean } | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<WorkoutSession | null>(null);
  const restRunId = useRef(0);
  /** nach Abschließen/Verwerfen nichts mehr speichern (verspätete Timer-Meldungen) */
  const closedRef = useRef(false);

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
        navigate("/calendar", { replace: true });
        return;
      }
      const ids = Array.from(new Set(loaded.exercises.map((e) => e.exerciseId)));
      const [exercises, notes, recents, plan] = await Promise.all([
        Promise.all(ids.map((id) => exerciseRepository.getById(id))),
        exerciseRepository.getNotes(),
        Promise.all(ids.map((id) => workoutRepository.getRecentPerformances(id, REQUIRED_SESSIONS, loaded.startedAt))),
        loaded.planId ? planRepository.getById(loaded.planId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      setContext({
        exercises: new Map(exercises.filter((e): e is Exercise => Boolean(e)).map((e) => [e.id, e])),
        notes: new Map(notes.map((n) => [n.exerciseId, n])),
        recent: new Map(ids.map((id, i) => [id, recents[i]])),
        planNotes: plan?.notes,
      });
      // laufende Timer aus der Zeit vor einem Neustart übernehmen
      const restored = restoreTimers(loaded, Date.now());
      sessionRef.current = restored.session;
      setSession(restored.session);
      if (restored.changed) {
        saveQueue.current = saveQueue.current
          .then(() => workoutRepository.saveSession(restored.session))
          .then(() => undefined)
          .catch(console.error);
      }
      if (restored.setTimer) setTimerTarget(restored.setTimer);
      if (restored.rest) {
        restRunId.current += 1;
        setRest({ runId: restRunId.current, ...restored.rest });
      }
      if (restored.completedWhileAway) {
        const entry = restored.session.exercises[restored.completedWhileAway.exerciseIndex];
        toast(t("session.timerDoneAway", { name: localized(entry.name, language) }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Sprache/Toast sind für das einmalige Laden nicht maßgeblich
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, navigate]);

  const elapsed = useElapsed(session?.startedAt);
  // Während des Trainings nicht automatisch sperren – sonst pausiert iOS die App samt Pausen-Timer.
  useWakeLock(Boolean(session));

  /** Jede Änderung sofort lokal speichern → Reload/App-Wechsel verliert nichts. */
  const commit = useCallback((next: WorkoutSession) => {
    if (closedRef.current) return;
    sessionRef.current = next;
    setSession(next);
    saveQueue.current = saveQueue.current
      .then(() => workoutRepository.saveSession(next))
      .then(() => undefined)
      .catch(console.error);
  }, []);

  const updateExercise = useCallback(
    (index: number, entry: SessionExercise) => {
      const prev = sessionRef.current;
      if (!prev) return;
      commit({ ...prev, exercises: prev.exercises.map((e, i) => (i === index ? entry : e)) });
    },
    [commit],
  );

  /** laufende Timer mitspeichern (Endzeit) – so überstehen sie Sperre und Neustart der App */
  const updateTimers = useCallback(
    (patch: Partial<SessionTimers>) => {
      const prev = sessionRef.current;
      if (!prev) return;
      const merged = { ...prev.timers, ...patch };
      const timers = merged.set || merged.rest ? { set: merged.set, rest: merged.rest } : undefined;
      if (!timers && !prev.timers) return;
      commit({ ...prev, timers });
    },
    [commit],
  );

  /** nach Änderungen im Info-Sheet Notiz/Übung neu laden (Karte zeigt die Notiz direkt an) */
  const refreshExerciseInfo = useCallback(async (exerciseId: string) => {
    const [exercise, note] = await Promise.all([exerciseRepository.getById(exerciseId), exerciseRepository.getNote(exerciseId)]);
    setContext((prev) => {
      if (!prev) return prev;
      const exercises = new Map(prev.exercises);
      const notes = new Map(prev.notes);
      if (exercise) exercises.set(exerciseId, exercise);
      if (note) notes.set(exerciseId, note);
      else notes.delete(exerciseId);
      return { ...prev, exercises, notes };
    });
  }, []);

  /** bei „Je Seite“ zählt ein Satz erst, wenn beide Seiten erledigt sind */
  const totals = useMemo(() => countSets(session?.exercises ?? []), [session]);

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
  const timerDurationSec = timerSet?.durationSec ?? timerEntry?.target.durationSec ?? 30;

  const onSetTimerChange = (snapshot: CountdownSnapshot) => {
    if (!timerTarget || !timerEntry) return;
    const base = { entryId: timerEntry.id, setIndex: timerTarget.setIndex, durationSec: timerDurationSec };
    if (snapshot.status === "running" && snapshot.endAt) {
      updateTimers({ set: { ...base, status: "running", endAt: new Date(snapshot.endAt).toISOString() } });
    } else if (snapshot.status === "paused") {
      updateTimers({ set: { ...base, status: "paused", remainingMs: snapshot.remainingMs } });
    } else {
      updateTimers({ set: undefined });
    }
  };

  const onRestChange = (snapshot: CountdownSnapshot) => {
    if (!rest) return;
    if (snapshot.status === "running" && snapshot.endAt) {
      updateTimers({ rest: { endAt: new Date(snapshot.endAt).toISOString(), seconds: rest.seconds, label: rest.label } });
    } else if (snapshot.status === "finished") {
      updateTimers({ rest: undefined });
    }
  };

  /** Sekunden Pause nach dem Satz, der mit Zeile `setIndex` endet – 0 = keine (auch nicht nach dem allerletzten Satz) */
  const restAfter = (entry: SessionExercise, setIndex: number): number => {
    const isLastSetOfExercise = setIndex >= entry.sets.length - (usesSides(entry) ? 2 : 1);
    const isLastExercise = session.exercises.at(-1)?.id === entry.id;
    const seconds = entry.target.restSec ?? 0;
    return seconds > 0 && !(isLastSetOfExercise && isLastExercise) ? seconds : 0;
  };

  /** läuft synchron im Tap auf den Haken → Ton und Haptik sind auf iOS entsperrt */
  const startRest = (entry: SessionExercise, setIndex: number) => {
    unlockAudio();
    tick();
    // „Je Seite“: Pause erst, wenn mit diesem Haken beide Seiten des Satzes erledigt sind
    if (usesSides(entry) && !entry.sets[partnerIndex(setIndex)]?.done) return;
    const seconds = restAfter(entry, setIndex);
    if (seconds > 0) {
      restRunId.current += 1;
      setRest({ runId: restRunId.current, seconds, label: localized(entry.name, language) });
    }
  };

  /** Timer eines Satzes öffnen – bei „Je Seite“ mit Zeit: die ganze Folge für die noch offenen Seiten */
  const openTimer = (exerciseIndex: number, setIndex: number) => {
    const entry = session.exercises[exerciseIndex];
    if (usesSides(entry) && entry.trackingType === "duration") {
      const first = setIndex - (setIndex % 2);
      const rows = openRows(entry, first);
      if (rows.length > 0) setTimerTarget({ exerciseIndex, setIndex: first, sequence: { rows, restSec: restAfter(entry, first) } });
      return;
    }
    setTimerTarget({ exerciseIndex, setIndex });
  };

  const onSideTimerChange = (snapshot: CountdownSnapshot, info: SideTimerInfo) => {
    if (!timerEntry) return;
    const base = {
      entryId: timerEntry.id,
      setIndex: info.rows[0],
      durationSec: info.totalSec,
      sequence: { rows: info.rows, restSec: info.restSec },
    };
    if (snapshot.status === "running" && snapshot.endAt) {
      updateTimers({ set: { ...base, status: "running", endAt: new Date(snapshot.endAt).toISOString() } });
    } else if (snapshot.status === "paused") {
      updateTimers({ set: { ...base, status: "paused", remainingMs: snapshot.remainingMs } });
    } else {
      updateTimers({ set: undefined });
    }
  };

  /** fertig gelaufene Seiten im Training abhaken (nie eine Seite doppelt, nie eine halbe als Satz) */
  const applySides = (results: SideResult[], originMs: number) => {
    if (!timerTarget) return undefined;
    const before = sessionRef.current?.exercises[timerTarget.exerciseIndex];
    if (!before) return undefined;
    const after = markSidesDone(before, results, originMs);
    if (after !== before) updateExercise(timerTarget.exerciseIndex, after);
    return { before, after };
  };

  const closeSideTimer = (restLeftSec?: number) => {
    const label = timerEntry ? localized(timerEntry.name, language) : "";
    setTimerTarget(null);
    updateTimers({ set: undefined });
    // wer die Satzpause wegtippt, behält sie unten als Pausenleiste
    if (restLeftSec && restLeftSec > 0) {
      restRunId.current += 1;
      setRest({ runId: restRunId.current, seconds: restLeftSec, label });
    }
  };

  /** Folge fertig (oder Satzpause übersprungen): nächster offener Satz derselben Übung steht bereit – ohne Start. */
  const onSideSequenceEnd = (skipped: boolean) => {
    updateTimers({ set: undefined });
    if (!timerTarget) return;
    const entry = sessionRef.current?.exercises[timerTarget.exerciseIndex];
    const nextFirst = timerTarget.setIndex + 2;
    const rows = entry ? openRows(entry, nextFirst) : [];
    if (entry && rows.length > 0) {
      setTimerTarget({ exerciseIndex: timerTarget.exerciseIndex, setIndex: nextFirst, sequence: { rows, restSec: restAfter(entry, nextFirst) } });
    } else if (skipped) {
      setTimerTarget(null);
    }
  };

  const openFinish = () => {
    dismissKeyboard();
    setDurationMin(Math.max(1, Math.round(elapsed / 60)));
    setFinishOpen(true);
  };

  /** Seite verlassen: erst Tastatur schließen – sonst bleibt auf iOS die Navigation verrutscht. */
  const leave = (to: string, options?: { replace?: boolean }) => {
    dismissKeyboard();
    navigate(to, options);
  };

  const confirmFinish = async () => {
    dismissKeyboard();
    closedRef.current = true;
    await saveQueue.current;
    await finishSession(sessionRef.current ?? session, (durationMin ?? Math.round(elapsed / 60)) * 60);
    setFinishOpen(false);
    toast(t("session.finished"));
    leave("/", { replace: true });
  };

  const discard = async () => {
    closedRef.current = true;
    await saveQueue.current;
    await workoutRepository.deleteSession(session.id);
    setDiscardOpen(false);
    leave("/training", { replace: true });
  };

  return (
    <Page withNav={false} className="pb-[calc(env(safe-area-inset-bottom)+200px)]">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line/60 bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => leave("/training")}
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
                recent={context.recent.get(entry.exerciseId) ?? []}
                personalNote={note?.note?.trim() || undefined}
                hasVideo={Boolean(exercise?.videoUrls?.length || note?.videoUrls?.length)}
                onChange={(next) => updateExercise(index, next)}
                onSetDone={(setIndex) => startRest(entry, setIndex)}
                onOpenTimer={(setIndex) => openTimer(index, setIndex)}
                onOpenInfo={() => {
                  dismissKeyboard();
                  setInfo({ exerciseId: entry.exerciseId, open: true });
                }}
              />
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence>
            {rest && (
              <RestTimer
                key="rest"
                runId={rest.runId}
                seconds={rest.seconds}
                label={rest.label}
                endAt={rest.endAt}
                onChange={onRestChange}
                onDone={() => {
                  setRest(null);
                  updateTimers({ rest: undefined });
                }}
              />
            )}
          </AnimatePresence>
          <Button size="lg" className="w-full" onClick={openFinish}>
            <Flag size={18} aria-hidden /> {t("session.finish")}
          </Button>
        </div>
      </div>

      <SideTimerSheet
        open={Boolean(timerTarget?.sequence && timerEntry)}
        onClose={closeSideTimer}
        title={timerEntry ? localized(timerEntry.name, language) : ""}
        entry={timerEntry}
        firstRow={timerTarget?.setIndex ?? 0}
        rows={timerTarget?.sequence?.rows ?? []}
        restSec={timerTarget?.sequence?.restSec ?? 0}
        resume={timerTarget?.resume}
        onTimerChange={onSideTimerChange}
        onSidesDone={(results, originMs) => void applySides(results, originMs)}
        onTakeOver={(results, originMs) => {
          const applied = applySides(results, originMs);
          const first = timerTarget?.setIndex ?? 0;
          // der Satz ist erst mit der zweiten Seite vollständig → erst dann Pause (unten, das Fenster schließt)
          const completed = applied && !isPairDone(applied.before.sets, first) && isPairDone(applied.after.sets, first);
          closeSideTimer();
          if (completed) startRest(applied.after, first + 1);
        }}
        onSequenceEnd={onSideSequenceEnd}
      />

      <TimerSheet
        open={Boolean(timerTarget && timerSet && !timerTarget.sequence)}
        onClose={() => {
          setTimerTarget(null);
          updateTimers({ set: undefined });
        }}
        title={timerEntry ? localized(timerEntry.name, language) : ""}
        subtitle={timerTarget && timerEntry?.trackingType !== "cardio" ? t("session.set", { n: timerTarget.setIndex + 1 }) : undefined}
        durationSec={timerDurationSec}
        resume={timerTarget?.resume}
        onTimerChange={onSetTimerChange}
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

      <ExerciseInfoSheet
        open={Boolean(info?.open)}
        onClose={() => setInfo((prev) => (prev ? { ...prev, open: false } : prev))}
        exercise={info ? context.exercises.get(info.exerciseId) : undefined}
        note={info ? context.notes.get(info.exerciseId) : undefined}
        onChanged={() => {
          if (info) void refreshExerciseInfo(info.exerciseId);
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
