import { motion } from "framer-motion";
import { ChartLine, Dumbbell, Home, MoreHorizontal, Utensils, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useApp } from "@/app/app-context";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/lib/utils";

/** Feste Hauptnavigation: genau fünf Punkte. `match` = Pfade, die zum Bereich gehören. */
const navItems: { labelKey: TranslationKey; icon: LucideIcon; to: string; match: (path: string) => boolean }[] = [
  { labelKey: "nav.today", icon: Home, to: "/", match: (p) => p === "/" || p.startsWith("/calendar") },
  { labelKey: "nav.training", icon: Dumbbell, to: "/training", match: (p) => p.startsWith("/training") || p.startsWith("/exercises") },
  { labelKey: "nav.progress", icon: ChartLine, to: "/progress", match: (p) => p.startsWith("/progress") },
  { labelKey: "nav.food", icon: Utensils, to: "/food", match: (p) => p.startsWith("/food") },
  { labelKey: "nav.more", icon: MoreHorizontal, to: "/more", match: (p) => p.startsWith("/more") },
];

/**
 * Animierte Pill-Navigation (Referenz: starter-reference/bottom-nav-bar.tsx).
 * Aktiver Punkt expandiert und zeigt Text, inaktive nur das Icon.
 */
export function BottomNavBar({ className }: { className?: string }) {
  const { t } = useApp();
  const { pathname } = useLocation();

  return (
    <>
      {/* Abdeckung zwischen Seiteninhalt und Navigation: unten deckend, nach oben weich auslaufend */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[calc(env(safe-area-inset-bottom)+112px)] bg-linear-to-t from-bg from-60% to-bg/0"
      />
      <motion.nav
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        aria-label={t("nav.aria")}
        className={cn(
          "fixed inset-x-0 z-50 mx-auto flex h-[60px] w-[calc(100%-24px)] max-w-[520px] items-center justify-between rounded-full border border-white/10 bg-card/95 px-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl",
          "bottom-[calc(env(safe-area-inset-bottom)+12px)]",
          className,
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          const isActive = item.match(pathname);

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className="flex min-w-11 justify-center rounded-full"
            >
              <motion.div
                layout
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className={cn(
                  "flex h-11 items-center justify-center rounded-full px-3 transition-colors",
                  isActive ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/5 hover:text-fg",
                )}
              >
                <Icon size={21} strokeWidth={2.15} aria-hidden />
                <motion.span
                  initial={false}
                  animate={{
                    width: isActive ? "auto" : 0,
                    opacity: isActive ? 1 : 0,
                    marginLeft: isActive ? 8 : 0,
                  }}
                  transition={{
                    width: { type: "spring", stiffness: 350, damping: 32 },
                    opacity: { duration: 0.16 },
                    marginLeft: { duration: 0.16 },
                  }}
                  className="overflow-hidden whitespace-nowrap text-xs font-bold"
                  aria-hidden
                >
                  {label}
                </motion.span>
              </motion.div>
            </Link>
          );
        })}
      </motion.nav>
    </>
  );
}

export default BottomNavBar;
