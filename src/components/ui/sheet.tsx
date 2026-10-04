import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useApp } from "@/app/app-context";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** volle Höhe für Listen (z. B. Übungsauswahl) */
  tall?: boolean;
};

/** Bottom Sheet für mobile Dialoge (Bestätigungen, Auswahl, Timer). */
export function Sheet({ open, onClose, title, description, children, footer, className, tall }: SheetProps) {
  const { t } = useApp();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      window.clearTimeout(focusTimer);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={cn(
              "relative flex w-full max-w-[560px] flex-col rounded-t-[28px] border border-b-0 border-line bg-card outline-none",
              tall ? "h-[88dvh]" : "max-h-[88dvh]",
              className,
            )}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-black tracking-tight">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
                aria-label={t("common.close")}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && (
              <div className="border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">{footer}</div>
            )}
            {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
