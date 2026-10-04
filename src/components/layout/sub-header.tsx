import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";

/** Kopfzeile für Unterseiten: Zurück + Titel + optionale Aktion */
export function SubHeader({ title, fallback, action }: { title?: string; fallback: string; action?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useApp();
  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
  return (
    <header className="mb-5 flex min-h-11 items-center gap-2">
      <button
        type="button"
        onClick={goBack}
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-white/5"
        aria-label={t("common.back")}
      >
        <ChevronLeft size={24} aria-hidden />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-black tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
