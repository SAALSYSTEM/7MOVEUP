import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { isWelcomeSeen, markWelcomeSeen } from "@/lib/welcome";

/** Auf Heute für neue Nutzer (noch kein Training, Seite nie geöffnet): eine ruhige Zeile, wegtippbar. */
export function WelcomeCard() {
  const { t } = useApp();
  const [hidden, setHidden] = useState(() => isWelcomeSeen());
  if (hidden) return null;
  return (
    <div className="mb-3 flex items-center rounded-[20px] border border-accent/40 bg-accent/10">
      <Link to="/welcome" className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 pl-4">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">{t("welcome.cardTitle")}</span>
          <span className="block truncate text-xs text-muted">{t("welcome.cardText")}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-accent" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => {
          markWelcomeSeen();
          setHidden(true);
        }}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-subtle hover:text-fg"
        aria-label={t("welcome.dismiss")}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
