import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; id?: string; controls?: string };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  layoutId: string;
  className?: string;
  /** "tabs" für Bereichsumschaltung, "radio" für Auswahl wie Sprache */
  role?: "tabs" | "radio";
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  layoutId,
  className,
  role = "tabs",
}: SegmentedProps<T>) {
  return (
    <div
      role={role === "tabs" ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      className={cn("flex rounded-full border border-line bg-card p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            id={option.id}
            type="button"
            role={role === "tabs" ? "tab" : "radio"}
            aria-selected={role === "tabs" ? active : undefined}
            aria-checked={role === "radio" ? active : undefined}
            aria-controls={option.controls}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors",
              active ? "text-black" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
