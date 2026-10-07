import { CircleCheck, Weight } from "lucide-react";

import { useApp } from "@/app/app-context";
import { plannedPerDay, type MeasureCard } from "@/domain/measure-plans";

/** Titel, Untertitel und Stand einer Plankarte – Heute, Erfassen und Kalender zeigen dasselbe. */
function useMeasureCardText(card: MeasureCard) {
  const { t } = useApp();
  const planned = plannedPerDay(card.plan);
  const count = card.measurements.length;
  const done = count >= planned;
  const title = card.plan.name.trim() || (done ? t("home.bodyDone") : t("body.captureTitle"));
  const subtitle =
    count === 0
      ? t("measure.planned", { count: planned })
      : done
        ? t("measure.recorded", { count })
        : `${t("measure.planned", { count: planned })} · ${t("measure.soFar", { count })}`;
  return { title, subtitle, done, count };
}

/** Eine Karte pro Messplan: „Blutdruck – 3× geplant · bereits 2“ und der Knopf „Erfassen“. Reine Information, kein Zwang. */
export function MeasureCardRow({ card, onCapture }: { card: MeasureCard; onCapture: () => void }) {
  const { t } = useApp();
  const { title, subtitle, done } = useMeasureCardText(card);
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-elevated py-2 pl-4 pr-2">
      <span className="flex min-w-0 items-center gap-3">
        {done ? (
          <CircleCheck size={20} className="shrink-0 text-success" aria-label={t("home.doneBadge")} />
        ) : (
          <Weight size={18} className="shrink-0 text-fg" aria-hidden />
        )}
        <span className="min-w-0">
          <span className={done ? "block truncate font-bold text-muted" : "block truncate font-bold"}>{title}</span>
          <span className="block truncate text-xs text-subtle">{subtitle}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onCapture}
        aria-label={`${t("progress.capture")}: ${title}`}
        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-accent px-3.5 text-sm font-extrabold text-black active:scale-[0.98]"
      >
        {t("progress.capture")}
      </button>
    </div>
  );
}
