import { Check, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { useApp } from "@/app/app-context";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { TimerResume } from "@/domain/active-session";
import { buildSequence, openRows, phaseAt, sideResults, totalSec, type SequencePhase, type SideResult } from "@/domain/side-sequence";
import { setNumber } from "@/domain/sides";
import type { SessionExercise, Side } from "@/domain/types";
import { useCountdown, type CountdownSnapshot } from "@/hooks/use-countdown";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { countdownBeep, finishSignal } from "@/services/feedback";

/** Was der Timer für das Speichern braucht: welche Zeilen er abhakt und wie lang die Folge insgesamt ist */
export type SideTimerInfo = { rows: number[]; restSec: number; totalSec: number };

type SideTimerSheetProps = {
  open: boolean;
  /** X: Läuft gerade die Satzpause, kommt deren Restzeit mit – sie läuft dann unten als Pausenleiste weiter. */
  onClose: (restLeftSec?: number) => void;
  title: string;
  /** das Training (aktueller Stand) und die Zeilen dieser Folge */
  entry: SessionExercise | undefined;
  /** erste Zeile des Satzes (gerade Zeilennummer) */
  firstRow: number;
  rows: number[];
  /** Satzpause am Ende der Folge (0 = keine, z. B. nach dem letzten Satz) */
  restSec: number;
  /** gespeicherten Timer fortsetzen (nach Neustart der App) */
  resume?: TimerResume;
  onTimerChange: (snapshot: CountdownSnapshot, info: SideTimerInfo) => void;
  /** fertig gelaufene Seiten abhaken (kommt, sobald eine Seite zu Ende ist) */
  onSidesDone: (results: SideResult[], originMs: number) => void;
  /** „Übernehmen“: bisher Gelaufenes abhaken, Fenster schließen */
  onTakeOver: (results: SideResult[], originMs: number) => void;
  /** Folge zu Ende bzw. Satzpause übersprungen */
  onSequenceEnd: (skipped: boolean) => void;
};

/**
 * Timer für einen Satz einer Zeitübung mit „Je Seite“: Seite → Wechsel → Seite → Satzpause als EIN Countdown.
 * Das Fenster bleibt über mehrere Sätze offen; der Inhalt wird pro Satz neu aufgebaut (`key`).
 */
export function SideTimerSheet(props: SideTimerSheetProps) {
  const { open, onClose, title, entry, firstRow } = props;
  const [running, setRunning] = useState(false);
  /** „Zurücksetzen“ baut die Folge dieses Satzes (`at`) aus den dann noch offenen Seiten neu auf */
  const [restartState, setRestartState] = useState<{ at: string; run: number; rows: number[] } | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  // Wie beim normalen Zeit-Timer verschwindet das Fenster beim Schließen sofort (eigener `key`): Der Inhalt
  // läuft nicht weiter, während es ausblendet. Zwischen zwei Sätzen bleibt es offen (derselbe `key`).
  const here = `${entry?.id}-${firstRow}`;
  const restart = restartState?.at === here ? restartState : null;

  if (!open || !entry) {
    return (
      <Sheet key="closed" open={false} onClose={() => onClose()} title={title}>
        {null}
      </Sheet>
    );
  }

  return (
    <Sheet key="open" open onClose={() => (closeRef.current ? closeRef.current() : onClose())} title={title} dismissible={!running}>
      <SideTimerBody
        key={`${here}-${restart?.run ?? 0}`}
        {...props}
        entry={entry}
        rows={restart?.rows ?? props.rows}
        resume={restart ? undefined : props.resume}
        closeRef={closeRef}
        onRunningChange={setRunning}
        onRestart={() => {
          const rows = openRows(entry, firstRow);
          setRestartState({ at: here, run: (restart?.run ?? 0) + 1, rows: rows.length > 0 ? rows : (restart?.rows ?? props.rows) });
        }}
      />
    </Sheet>
  );
}

type BodyProps = Omit<SideTimerSheetProps, "open" | "entry"> & {
  entry: SessionExercise;
  closeRef: MutableRefObject<(() => void) | null>;
  onRunningChange: (running: boolean) => void;
  onRestart: () => void;
};

const PHASE_COLOR = { work: "var(--color-accent)", switch: "var(--color-warning)", rest: "var(--color-cardio)" } as const;
const PHASE_TEXT = { work: "text-accent-light", switch: "text-warning", rest: "text-cardio" } as const;

function SideTimerBody({
  entry,
  firstRow,
  rows,
  restSec,
  resume,
  closeRef,
  onClose,
  onTimerChange,
  onSidesDone,
  onTakeOver,
  onSequenceEnd,
  onRunningChange,
  onRestart,
}: BodyProps) {
  const { t } = useApp();
  // Die Folge steht beim Öffnen fest (auch wenn Seiten währenddessen abgehakt werden).
  const [phases] = useState<SequencePhase[]>(() => buildSequence(entry, rows, restSec));
  const total = totalSec(phases);

  const callbacks = useRef({ onTimerChange, onSidesDone, onSequenceEnd });
  useEffect(() => {
    callbacks.current = { onTimerChange, onSidesDone, onSequenceEnd };
  });

  /** Seiten, die schon gemeldet wurden – jede genau einmal */
  const reported = useRef(new Set<number>());
  const reportSides = (elapsedMs: number) => {
    const fresh = sideResults(phases, elapsedMs, true).filter((r) => !reported.current.has(r.rowIndex));
    if (fresh.length === 0) return;
    for (const r of fresh) reported.current.add(r.rowIndex);
    callbacks.current.onSidesDone(fresh, Date.now() - elapsedMs);
  };

  const countdown = useCountdown(total, {
    signals: false,
    onChange: (snapshot) => callbacks.current.onTimerChange(snapshot, { rows, restSec, totalSec: total }),
    onFinish: () => {
      finishSignal();
      // die letzte Seite endet ggf. genau jetzt (ohne Satzpause) – vor dem Weiterschalten abhaken
      reportSides(total * 1000);
      callbacks.current.onSequenceEnd(false);
    },
  });

  // gespeicherten Stand einmalig übernehmen
  const resumed = useRef(false);
  const { start, restorePaused } = countdown;
  useEffect(() => {
    if (resumed.current || !resume) return;
    resumed.current = true;
    if (resume.status === "running") start(Math.max(0, resume.endAt - Date.now()));
    else restorePaused(resume.remainingMs);
  }, [resume, start, restorePaused]);

  const { status } = countdown;
  const elapsedMs = Math.min(total * 1000, Math.max(0, total * 1000 - countdown.remainingMs));
  const pos = phaseAt(phases, elapsedMs);
  const started = status !== "idle";
  const finished = status === "finished";
  const inRest = pos.phase.kind === "rest" && (status === "running" || status === "paused");

  // jede Seite abhaken, sobald sie zu Ende ist
  useEffect(() => {
    if (status !== "idle") reportSides(elapsedMs);
  });

  // Signale: Piepen in den letzten 3 Sekunden jeder Phase, langer Ton beim Wechsel der Phase
  const cue = useRef<{ index: number; sec: number | null }>({ index: -1, sec: null });
  useEffect(() => {
    if (status !== "running") return;
    if (cue.current.index !== pos.index) {
      if (cue.current.index >= 0 && pos.index > cue.current.index) finishSignal();
      cue.current = { index: pos.index, sec: null };
    }
    const secLeft = Math.ceil(pos.leftMs / 1000);
    if (!pos.finished && secLeft >= 1 && secLeft <= 3 && cue.current.sec !== secLeft) {
      cue.current.sec = secLeft;
      countdownBeep();
    }
  });

  useEffect(() => {
    onRunningChange(status === "running");
    return () => onRunningChange(false);
  }, [status, onRunningChange]);

  // X im Kopf des Fensters: Satzpause läuft unten weiter
  useEffect(() => {
    closeRef.current = () => onClose(inRest ? Math.max(1, Math.ceil(pos.leftMs / 1000)) : undefined);
    return () => {
      closeRef.current = null;
    };
  });

  const sideText = (side: Side) => t(side === "left" ? "common.left" : "common.right");
  const phaseLabel = (phase: SequencePhase) =>
    phase.kind === "work" ? sideText(phase.side) : phase.kind === "switch" ? t("timer.switch") : t("timer.restPhase");

  const firstWork = phases.find((p): p is Extract<SequencePhase, { kind: "work" }> => p.kind === "work");
  const number = setNumber(rows[0] ?? firstRow);

  const phaseMs = pos.phase.sec * 1000;
  const progress = finished ? 0 : phaseMs > 0 ? pos.leftMs / phaseMs : 0;
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const lastSeconds = status === "running" && pos.leftMs <= 3000;
  const results = sideResults(phases, elapsedMs);

  const statusText = { idle: t("timer.ready"), running: t("timer.running"), paused: t("timer.paused"), finished: t("timer.finished") }[status];

  return (
    <div className="flex flex-col items-center pb-2">
      <p className={cn("mb-3 text-center text-sm font-bold", !started ? "text-accent-light" : "text-muted")} aria-live="polite">
        {!started && firstWork
          ? `${t("timer.getReady")} – ${t("timer.setSide", { n: number, side: sideText(firstWork.side).toUpperCase() })}`
          : t("session.set", { n: number })}
      </p>

      <ol className="mb-4 flex flex-wrap justify-center gap-1.5" aria-label={t("session.set", { n: number })}>
        {phases.map((phase, i) => {
          const current = started && !finished && i === pos.index;
          const past = finished || (started && i < pos.index);
          return (
            <li
              key={`${phase.kind}-${i}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "tabular inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
                current ? "border-accent bg-accent/15 text-accent-light" : past ? "border-success/40 text-success" : "border-line text-muted",
              )}
            >
              {past && <Check size={11} strokeWidth={3} aria-hidden />}
              {phaseLabel(phase)} {formatDuration(phase.sec)}
            </li>
          );
        })}
      </ol>

      <div className="relative h-[248px] w-[248px]">
        <svg viewBox="0 0 248 248" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="124" cy="124" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="10" />
          <circle
            cx="124"
            cy="124"
            r={radius}
            fill="none"
            stroke={finished ? "var(--color-success)" : PHASE_COLOR[pos.phase.kind]}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            aria-live="polite"
            className={cn("text-[13px] font-extrabold uppercase tracking-[0.2em]", finished ? "text-success" : PHASE_TEXT[pos.phase.kind])}
          >
            {finished ? t("timer.done") : phaseLabel(pos.phase)}
          </span>
          <span
            role="timer"
            aria-label={`${t("timer.remaining")}: ${Math.ceil(pos.leftMs / 1000)} ${t("common.sec")}`}
            className={cn(
              "tabular text-[72px] font-black leading-none tracking-[-0.04em]",
              lastSeconds && "text-accent",
              finished && "text-success",
            )}
          >
            {finished ? "0:00" : formatDuration(Math.ceil(pos.leftMs / 1000))}
          </span>
          <span
            className={cn(
              "mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
              status === "running" && "bg-accent/15 text-accent-light",
              status === "paused" && "bg-white/10 text-fg",
              status === "idle" && "bg-white/5 text-muted",
              finished && "bg-success/15 text-success",
            )}
          >
            {finished ? `✓ ${t("timer.finished")}` : statusText}
          </span>
        </div>
      </div>

      {finished ? (
        <Button variant="outline" className="mt-6 w-full" onClick={() => onClose()}>
          {t("common.close")}
        </Button>
      ) : (
        <>
          <div className="mt-6 grid w-full grid-cols-[56px_1fr] items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="h-14 w-14"
              disabled={!started || inRest}
              onClick={() => {
                countdown.reset();
                onRestart();
              }}
              aria-label={t("timer.reset")}
            >
              <RotateCcw size={20} aria-hidden />
            </Button>
            {status === "running" ? (
              <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={countdown.pause}>
                <Pause size={22} aria-hidden /> {t("timer.pause")}
              </Button>
            ) : (
              <Button size="lg" className="h-16 text-lg" onClick={() => countdown.start()}>
                <Play size={22} fill="currentColor" aria-hidden />
                {status === "paused" ? t("timer.resume") : t("timer.start")}
              </Button>
            )}
          </div>

          {inRest ? (
            <Button variant="ghost" className="mt-3 w-full" onClick={() => callbacks.current.onSequenceEnd(true)}>
              <SkipForward size={18} aria-hidden /> {t("session.skip")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="mt-3 w-full"
              disabled={results.length === 0}
              onClick={() => onTakeOver(results, Date.now() - elapsedMs)}
            >
              <Check size={18} aria-hidden /> {t("timer.takeOver")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
