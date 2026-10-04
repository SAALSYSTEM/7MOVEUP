import { ChevronRight, Plus, StickyNote, Video } from "lucide-react";
import type { ReactNode } from "react";

import { useApp } from "@/app/app-context";
import type { Exercise } from "@/domain/types";
import { exerciseName } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = {
  exercise: Exercise;
  hasNote?: boolean;
  hasVideo?: boolean;
  trailing?: "chevron" | "add";
  onClick?: () => void;
  className?: string;
};

export function ExerciseRow({ exercise, hasNote, hasVideo, trailing = "chevron", onClick, className }: Props) {
  const { t, language } = useApp();
  const meta: ReactNode[] = [
    exercise.bodyRegions.slice(0, 2).map((r) => t(`region.${r}`)).join(" · "),
    t(`tracking.${exercise.trackingType}`),
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-card px-4 py-3 text-left transition-colors hover:bg-elevated active:bg-elevated",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold">{exerciseName(exercise, language)}</span>
          {!exercise.builtIn && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-light">
              {t("exercises.custom")}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-subtle">{meta.join("  ·  ")}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-subtle">
        {hasVideo && <Video size={15} aria-label={t("exercises.hasVideo")} />}
        {hasNote && <StickyNote size={15} aria-label={t("exercises.hasNote")} />}
        {trailing === "chevron" ? (
          <ChevronRight size={18} aria-hidden />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Plus size={16} aria-hidden />
          </span>
        )}
      </span>
    </button>
  );
}
