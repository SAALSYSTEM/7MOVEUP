import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type MotivationLoopProps = {
  lines: string[];
  className?: string;
};

/** Sichtbarkeitsdauer pro Durchlauf in ms (Einblenden + Halten + Ausblenden). */
const CYCLE_MS = 4600;

const lineClass =
  "text-balance text-[clamp(2.15rem,10.5vw,4.6rem)] font-black uppercase leading-[0.98] tracking-[-0.05em]";

/**
 * Tagesspruch als Endlosschleife: Wörter gleiten weich herein, bleiben kurz stehen,
 * verlassen die Fläche und der GLEICHE Spruch beginnt von vorn – solange die Seite offen ist.
 * Bei prefers-reduced-motion wird der Spruch statisch gezeigt.
 */
export function MotivationLoop({ lines, className }: MotivationLoopProps) {
  const reduceMotion = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setCycle((value) => value + 1), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const staticLines = lines.map((line, lineIndex) => (
    <div key={`${line}-${lineIndex}`} className={cn(lineClass, lineIndex === lines.length - 1 ? "text-accent" : "text-fg")}>
      {line.split(" ").map((word, wordIndex) => (
        <span key={`${word}-${wordIndex}`} className="mr-[0.22em] inline-block last:mr-0">
          {word}
        </span>
      ))}
    </div>
  ));

  const label = lines.join(" ");

  if (reduceMotion) {
    return (
      <div className={cn("space-y-1", className)}>{staticLines}</div>
    );
  }

  return (
    <div className={cn("relative", className)} role="img" aria-label={label}>
      {/* unsichtbarer Platzhalter bestimmt die Höhe – nichts wird abgeschnitten */}
      <div className="invisible" aria-hidden>
        {staticLines}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={cycle}
          initial="hidden"
          animate="show"
          exit="exit"
          aria-hidden
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
            exit: { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
          }}
          className="absolute inset-0"
        >
          {lines.map((line, lineIndex) => (
            <motion.div
              key={`${line}-${lineIndex}`}
              className={cn(lineClass, lineIndex === lines.length - 1 ? "text-accent" : "text-fg")}
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.09 } },
                exit: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
              }}
            >
              {line.split(" ").map((word, wordIndex) => (
                <motion.span
                  key={`${word}-${wordIndex}`}
                  className="mr-[0.22em] inline-block last:mr-0"
                  variants={{
                    hidden: { y: "0.55em", opacity: 0, filter: "blur(10px)" },
                    show: {
                      y: 0,
                      opacity: 1,
                      filter: "blur(0px)",
                      transition: { type: "spring", stiffness: 170, damping: 22, mass: 0.9 },
                    },
                    exit: {
                      y: "-0.45em",
                      opacity: 0,
                      filter: "blur(8px)",
                      transition: { duration: 0.38, ease: [0.4, 0, 0.6, 1] },
                    },
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
