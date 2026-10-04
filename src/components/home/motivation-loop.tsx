import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MotivationLoopProps = {
  words: readonly string[];
  className?: string;
};

/** Einblenden (s) – Wort fährt leicht von unten ein */
const ENTER_SEC = 0.42;
/** Ausblenden (s) – Wort fährt leicht nach oben heraus */
const EXIT_SEC = 0.38;
/** voll sichtbare Zeit pro Wort (ms) */
const HOLD_MS = 1200;
/** letztes Wort steht etwas länger, bevor der Spruch von vorn beginnt */
const LAST_WORD_HOLD_MS = 1400;

/**
 * Tagesspruch als Wortfolge: Es ist immer genau ein Wort sichtbar.
 * SMALL → STEPS → BIG → PROGRESS → SMALL → … endlos, solange die Startseite offen ist.
 */
export function MotivationLoop({ words, className }: MotivationLoopProps) {
  const reduceMotion = useReducedMotion() ?? false;
  // zählt endlos hoch → jedes Wort bekommt einen neuen Key, auch beim zweiten Durchlauf
  const [step, setStep] = useState(0);
  const index = step % words.length;
  const isLast = index === words.length - 1;
  const longest = Math.max(...words.map((w) => w.length));

  return (
    <div role="img" aria-label={words.join(" ")} className={cn("@container w-full", className)}>
      <div
        aria-hidden
        className="relative flex h-[1.2em] items-center justify-center overflow-hidden font-black uppercase leading-none tracking-[-0.045em]"
        // Größe richtet sich nach dem längsten Wort des Spruchs → kein Größensprung zwischen Wörtern
        style={{ fontSize: `min(6.25rem, calc(100cqw / ${(longest * 0.74).toFixed(2)}))` }}
      >
        <AnimatePresence mode="wait" initial>
          <Word
            key={step}
            word={words[index]}
            accent={isLast}
            holdMs={isLast ? LAST_WORD_HOLD_MS : HOLD_MS}
            reduceMotion={reduceMotion}
            onDone={() => setStep((value) => value + 1)}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

function Word({
  word,
  accent,
  holdMs,
  reduceMotion,
  onDone,
}: {
  word: string;
  accent: boolean;
  holdMs: number;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Zeit läuft ab Mount: Einblenden + Haltezeit, danach übernimmt das Ausblenden (AnimatePresence)
  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), ENTER_SEC * 1000 + holdMs);
    return () => window.clearTimeout(id);
  }, [holdMs]);

  const offset = reduceMotion ? 0 : 1;

  return (
    <motion.span
      className={cn("block whitespace-nowrap", accent ? "text-accent" : "text-fg")}
      initial={{ opacity: 0, y: `${0.3 * offset}em`, filter: `blur(${4 * offset}px)` }}
      animate={{
        opacity: 1,
        y: "0em",
        filter: "blur(0px)",
        transition: { duration: ENTER_SEC, ease: [0.22, 1, 0.36, 1] },
      }}
      exit={{
        opacity: 0,
        y: `${-0.24 * offset}em`,
        filter: `blur(${4 * offset}px)`,
        transition: { duration: EXIT_SEC, ease: [0.4, 0, 0.7, 1] },
      }}
    >
      {word}
    </motion.span>
  );
}
