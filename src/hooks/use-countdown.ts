import { useCallback, useEffect, useRef, useState } from "react";

import { countdownBeep, finishSignal, unlockAudio } from "@/services/feedback";

export type CountdownStatus = "idle" | "running" | "paused" | "finished";

type Options = {
  onFinish?: () => void;
  /** Piepen in den letzten 3 Sekunden + Endsignal */
  signals?: boolean;
};

/**
 * Countdown auf Basis eines Endzeitpunkts – bleibt korrekt, auch wenn der Browser
 * Intervalle im Hintergrund drosselt. Letzte 3 Sekunden: je ein kurzer Piepton,
 * bei 0 ein längeres, anderes Abschlusssignal.
 * Ändert sich die Gesamtzeit, die Komponente per `key` neu mounten.
 */
export function useCountdown(totalSec: number, { onFinish, signals = true }: Options = {}) {
  const [status, setStatus] = useState<CountdownStatus>("idle");
  const [remainingMs, setRemainingMs] = useState(totalSec * 1000);
  const endAtRef = useRef(0);
  const lastBeepRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setStatus("finished");
        if (signals) finishSignal();
        onFinishRef.current?.();
        return;
      }
      setRemainingMs(left);
      const secondsLeft = Math.ceil(left / 1000);
      if (signals && secondsLeft <= 3 && lastBeepRef.current !== secondsLeft) {
        lastBeepRef.current = secondsLeft;
        countdownBeep();
      }
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [status, signals]);

  const start = useCallback(
    (fromMs?: number) => {
      unlockAudio();
      const base = fromMs ?? (status === "finished" ? totalSec * 1000 : remainingMs);
      endAtRef.current = Date.now() + base;
      // bereits angekündigte Sekunden nicht doppelt piepen
      const secondsLeft = Math.ceil(base / 1000);
      lastBeepRef.current = secondsLeft <= 3 ? secondsLeft : null;
      setRemainingMs(base);
      setStatus("running");
    },
    [remainingMs, status, totalSec],
  );

  const pause = useCallback(() => {
    if (status !== "running") return;
    setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    setStatus("paused");
  }, [status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setRemainingMs(totalSec * 1000);
    lastBeepRef.current = null;
  }, [totalSec]);

  const addSeconds = useCallback(
    (seconds: number) => {
      if (status === "running") {
        endAtRef.current += seconds * 1000;
        setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
      } else {
        setRemainingMs((ms) => Math.max(0, ms + seconds * 1000));
      }
    },
    [status],
  );

  const elapsedSec = Math.max(0, Math.round((totalSec * 1000 - remainingMs) / 1000));

  return { status, remainingMs, remainingSec: Math.ceil(remainingMs / 1000), elapsedSec, start, pause, reset, addSeconds };
}

/** Bildschirm während eines laufenden Timers wach halten (sofern unterstützt). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type WakeLockSentinelLike = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    let sentinel: WakeLockSentinelLike | undefined;
    let released = false;
    nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (released) void lock.release();
        else sentinel = lock;
      })
      .catch(() => {});
    return () => {
      released = true;
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
