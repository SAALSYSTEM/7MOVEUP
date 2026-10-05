import { useCallback, useEffect, useRef, useState } from "react";

import { countdownBeep, finishSignal, unlockAudio } from "@/services/feedback";

export type CountdownStatus = "idle" | "running" | "paused" | "finished";

export type CountdownSnapshot = {
  status: CountdownStatus;
  /** Endzeitpunkt (ms), solange er läuft */
  endAt?: number;
  remainingMs: number;
};

type Options = {
  onFinish?: () => void;
  /** bei Start, Pause, Zeit dazu, Reset und Ende – z. B. um den Timer zu speichern */
  onChange?: (snapshot: CountdownSnapshot) => void;
  /** Piepen in den letzten 3 Sekunden + Endsignal */
  signals?: boolean;
};

/**
 * Countdown auf Basis eines Endzeitpunkts – bleibt korrekt, auch wenn der Browser
 * Intervalle im Hintergrund drosselt. Letzte 3 Sekunden: je ein kurzer Piepton,
 * bei 0 ein längeres, anderes Abschlusssignal.
 * Ändert sich die Gesamtzeit, die Komponente per `key` neu mounten.
 */
export function useCountdown(totalSec: number, { onFinish, onChange, signals = true }: Options = {}) {
  const [status, setStatus] = useState<CountdownStatus>("idle");
  const [remainingMs, setRemainingMs] = useState(totalSec * 1000);
  const endAtRef = useRef(0);
  const lastBeepRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onFinishRef.current = onFinish;
    onChangeRef.current = onChange;
  });
  const notify = (snapshot: CountdownSnapshot) => onChangeRef.current?.(snapshot);

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setStatus("finished");
        if (signals) finishSignal();
        onFinishRef.current?.();
        onChangeRef.current?.({ status: "finished", remainingMs: 0 });
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
      notify({ status: "running", endAt: endAtRef.current, remainingMs: base });
    },
    [remainingMs, status, totalSec],
  );

  const pause = useCallback(() => {
    if (status !== "running") return;
    const left = Math.max(0, endAtRef.current - Date.now());
    setRemainingMs(left);
    setStatus("paused");
    notify({ status: "paused", remainingMs: left });
  }, [status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setRemainingMs(totalSec * 1000);
    lastBeepRef.current = null;
    notify({ status: "idle", remainingMs: totalSec * 1000 });
  }, [totalSec]);

  /** gespeicherten, pausierten Timer wiederherstellen */
  const restorePaused = useCallback((ms: number) => {
    setRemainingMs(Math.max(0, ms));
    setStatus("paused");
  }, []);

  const addSeconds = useCallback(
    (seconds: number) => {
      if (status === "running") {
        endAtRef.current += seconds * 1000;
        const left = Math.max(0, endAtRef.current - Date.now());
        setRemainingMs(left);
        notify({ status: "running", endAt: endAtRef.current, remainingMs: left });
      } else {
        const next = Math.max(0, remainingMs + seconds * 1000);
        setRemainingMs(next);
        if (status === "paused") notify({ status: "paused", remainingMs: next });
      }
    },
    [status, remainingMs],
  );

  const elapsedSec = Math.max(0, Math.round((totalSec * 1000 - remainingMs) / 1000));

  return { status, remainingMs, remainingSec: Math.ceil(remainingMs / 1000), elapsedSec, start, pause, reset, addSeconds, restorePaused };
}

/**
 * Bildschirm wach halten, solange `active` (sofern unterstützt; iPhone-Home-Bildschirm-App ab iOS 18.4).
 * Der Browser gibt die Sperre beim Verlassen der App frei – sie wird bei Rückkehr bzw. beim
 * nächsten Tippen erneut angefordert.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let pending = false;
    let disposed = false;

    const acquire = () => {
      if (disposed || pending || (sentinel && !sentinel.released) || document.visibilityState !== "visible") return;
      pending = true;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (disposed) void lock.release().catch(() => {});
          else sentinel = lock;
        })
        .catch(() => {})
        .finally(() => {
          pending = false;
        });
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    window.addEventListener("click", acquire, { capture: true, passive: true });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      window.removeEventListener("click", acquire, { capture: true });
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
