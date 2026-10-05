import type { ReactNode } from "react";

import { useApp } from "@/app/app-context";
import { cn } from "@/lib/utils";
import { getHapticsSupport } from "@/services/feedback";

/**
 * iPhone-Haptik für einen Button.
 *
 * Web-Apps dürfen auf iOS nicht vibrieren (`navigator.vibrate` fehlt). Safari spielt aber beim
 * Antippen eines `<input type="checkbox" switch>` die System-Haptik ab – seit iOS 26.5 nur noch
 * bei einem echten Fingertipp, nicht per Skript. Deshalb liegt auf iOS eine unsichtbare
 * Switch-Fläche über dem Button, fängt den Tipp ab und ruft dieselbe Aktion auf.
 * Tastatur und VoiceOver bedienen weiterhin den Button darunter (die Fläche ist aria-hidden).
 */
export function HapticTap({ onTap, className, children }: { onTap: () => void; className?: string; children: ReactNode }) {
  const { settings } = useApp();
  const active = settings.hapticsEnabled && getHapticsSupport() === "ios";
  if (!active) return <>{children}</>;
  return (
    <span className={cn("relative flex", className)}>
      {children}
      <input
        type="checkbox"
        ref={(el) => el?.setAttribute("switch", "")}
        aria-hidden
        tabIndex={-1}
        onClick={onTap}
        data-haptic-tap=""
        className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
