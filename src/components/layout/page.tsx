import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard-Seitencontainer mit Safe-Area oben und Platz für die Bottom-Navigation. */
export function Page({ children, className, withNav = true }: { children?: ReactNode; className?: string; withNav?: boolean }) {
  return (
    <main
      className={cn(
        "mx-auto min-h-dvh w-full max-w-2xl px-4 pt-safe",
        withNav ? "pb-nav" : "pb-[calc(env(safe-area-inset-bottom)+120px)]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-line px-5 py-8 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      {title && <p className="text-sm font-bold text-fg">{title}</p>}
      {children && <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
