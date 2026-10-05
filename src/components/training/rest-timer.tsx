import { motion } from "framer-motion";
import { SkipForward, Timer } from "lucide-react";
import { useEffect } from "react";

import { useApp } from "@/app/app-context";
import { useCountdown, type CountdownSnapshot } from "@/hooks/use-countdown";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/utils";

type RestTimerProps = {
  /** wechselt bei jedem neuen Pausenstart → Timer startet neu */
  runId: number;
  seconds: number;
  label: string;
  onDone: () => void;
  /** Endzeitpunkt (ms) eines gespeicherten Timers – nach Neustart der App */
  endAt?: number;
  /** Start, Zeit dazu und Ende melden (zum Speichern) */
  onChange?: (snapshot: CountdownSnapshot) => void;
};

/** Pausen-Countdown nach einem abgehakten Satz (gleiche Signale wie Zeitübungen). */
export function RestTimer({ runId, seconds, label, onDone, endAt, onChange }: RestTimerProps) {
  const { t } = useApp();
  const timer = useCountdown(seconds, { onFinish: () => window.setTimeout(onDone, 1200), onChange });
  const { start } = timer;

  useEffect(() => {
    start(endAt ? Math.max(0, endAt - Date.now()) : seconds * 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const progress = seconds > 0 ? timer.remainingMs / (seconds * 1000) : 0;
  const finished = timer.status === "finished";

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="relative mb-2 overflow-hidden rounded-2xl border border-line bg-elevated"
    >
      <div
        className={cn("absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear", finished ? "bg-success/15" : "bg-accent/12")}
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3 py-1.5 pl-4 pr-1.5">
        <Timer size={18} className={finished ? "text-success" : "text-accent"} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">
            {t("session.restTimer")} · {label}
          </p>
          <p role="timer" className={cn("tabular text-xl font-black leading-tight", finished && "text-success")}>
            {finished ? t("timer.done") : formatDuration(timer.remainingSec)}
          </p>
        </div>
        {!finished && (
          <button
            type="button"
            onClick={() => timer.addSeconds(15)}
            className="h-11 rounded-xl px-3 text-sm font-black text-muted hover:bg-white/5 hover:text-fg"
            aria-label="+15 s"
          >
            +15
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-fg hover:bg-white/5"
        >
          <SkipForward size={16} aria-hidden /> {finished ? t("common.close") : t("session.skip")}
        </button>
      </div>
    </motion.div>
  );
}
