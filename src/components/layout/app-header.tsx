import type { ReactNode } from "react";

import { useApp } from "@/app/app-context";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  /** linke Seite: Seitentitel oder Datum */
  left?: ReactNode;
  className?: string;
};

/** Kompakter Header: links Kontext, rechts Brand-Icon + lokaler Profilname (Fallback ICH/ME). */
export function AppHeader({ left, className }: AppHeaderProps) {
  const { displayName } = useApp();
  return (
    <header className={cn("mb-6 flex min-h-11 items-center justify-between gap-3", className)}>
      <div className="min-w-0">{left}</div>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-card p-1.5 pr-3.5">
        <img src={asset("icons/header-icon-64.png")} alt="7MOVEUP" width={32} height={32} className="h-8 w-8 rounded-[10px]" />
        <span className="max-w-32 truncate text-xs font-extrabold uppercase tracking-wide">{displayName}</span>
      </div>
    </header>
  );
}

export function PageTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="min-w-0">
      {eyebrow && (
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-subtle">{eyebrow}</p>
      )}
      <h1 className="truncate text-[28px] font-black leading-tight tracking-[-0.03em]">{children}</h1>
    </div>
  );
}
