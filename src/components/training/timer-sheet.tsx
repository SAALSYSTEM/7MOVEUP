import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

import { useApp } from "@/app/app-context";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { TimerResume } from "@/domain/active-session";
import { useCountdown, type CountdownSnapshot } from "@/hooks/use-countdown";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";

type TimerSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  durationSec: number;
  /** Satz mit tatsächlich gelaufener Zeit abhaken */
  onComplete: (elapsedSec: number) => void;
  /** gespeicherten Timer fortsetzen (nach Neustart der App) */
  resume?: TimerResume;
  /** Zustandswechsel melden, damit das Training den Timer speichern kann */
  onTimerChange?: (snapshot: CountdownSnapshot) => void;
};

export function TimerSheet(props: TimerSheetProps) {
  // Neu mounten pro Öffnung → frischer Timer-Zustand
  if (!props.open) return <Sheet open={false} onClose={props.onClose} title={props.title}>{null}</Sheet>;
  return <TimerSheetInner key={`${props.title}-${props.subtitle}-${props.durationSec}`} {...props} />;
}

function TimerSheetInner({ open, onClose, title, subtitle, durationSec, onComplete, resume, onTimerChange }: TimerSheetProps) {
  const { t } = useApp();
  const timer = useCountdown(durationSec, {
    onFinish: () => onComplete(durationSec),
    onChange: onTimerChange,
  });

  // gespeicherten Stand einmalig übernehmen
  const resumed = useRef(false);
  const { start, restorePaused } = timer;
  useEffect(() => {
    if (resumed.current || !resume) return;
    resumed.current = true;
    if (resume.status === "running") start(Math.max(0, resume.endAt - Date.now()));
    else restorePaused(resume.remainingMs);
  }, [resume, start, restorePaused]);

  const progress = durationSec > 0 ? timer.remainingMs / (durationSec * 1000) : 0;
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const lastSeconds = timer.status === "running" && timer.remainingSec <= 3;

  const statusText = {
    idle: t("timer.ready"),
    running: t("timer.running"),
    paused: t("timer.paused"),
    finished: t("timer.finished"),
  }[timer.status];

  return (
    <Sheet open={open} onClose={onClose} title={title} description={subtitle} dismissible={timer.status !== "running"}>
      <div className="flex flex-col items-center pb-2 pt-2">
        <div className="relative h-[248px] w-[248px]">
          <svg viewBox="0 0 248 248" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="124" cy="124" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="10" />
            <circle
              cx="124"
              cy="124"
              r={radius}
              fill="none"
              stroke={timer.status === "finished" ? "var(--color-success)" : "var(--color-accent)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-subtle">{t("timer.remaining")}</span>
            <span
              role="timer"
              aria-label={`${t("timer.remaining")}: ${timer.remainingSec} ${t("common.sec")}`}
              className={cn(
                "tabular text-[72px] font-black leading-none tracking-[-0.04em]",
                lastSeconds && "text-accent",
                timer.status === "finished" && "text-success",
              )}
            >
              {timer.status === "finished" ? "0:00" : formatDuration(timer.remainingSec)}
            </span>
            <span
              aria-live="polite"
              className={cn(
                "mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                timer.status === "running" && "bg-accent/15 text-accent-light",
                timer.status === "paused" && "bg-white/10 text-fg",
                timer.status === "idle" && "bg-white/5 text-muted",
                timer.status === "finished" && "bg-success/15 text-success",
              )}
            >
              {timer.status === "finished" ? `✓ ${t("timer.done")}` : statusText}
            </span>
          </div>
        </div>

        <div className="mt-6 grid w-full grid-cols-[56px_1fr_56px] items-center gap-3">
          <Button variant="secondary" size="icon" className="h-14 w-14" onClick={timer.reset} aria-label={t("timer.reset")}>
            <RotateCcw size={20} aria-hidden />
          </Button>
          {timer.status === "running" ? (
            <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={timer.pause}>
              <Pause size={22} aria-hidden /> {t("timer.pause")}
            </Button>
          ) : (
            <Button size="lg" className="h-16 text-lg" onClick={() => timer.start()}>
              <Play size={22} fill="currentColor" aria-hidden />
              {timer.status === "paused" ? t("timer.resume") : t("timer.start")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-14 w-14 text-sm font-black"
            onClick={() => timer.addSeconds(10)}
            aria-label="+10 s"
            disabled={timer.status === "finished"}
          >
            +10
          </Button>
        </div>

        {timer.status === "finished" ? (
          <Button variant="outline" className="mt-3 w-full" onClick={onClose}>
            {t("common.close")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="mt-3 w-full"
            disabled={timer.elapsedSec === 0}
            onClick={() => {
              onComplete(timer.elapsedSec);
              onClose();
            }}
          >
            <Check size={18} aria-hidden /> {t("timer.takeOver")}
            {timer.elapsedSec > 0 ? ` (${formatDuration(timer.elapsedSec)})` : ""}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
