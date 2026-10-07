import { CircleCheck } from "lucide-react";

import { useApp } from "@/app/app-context";
import { plannedPerDay, type MeasureCard } from "@/domain/measure-plans";

/** Titel, Untertitel und Stand einer Plankarte – Heute, Erfassen und Kalender zeigen dasselbe. */
function useMeasureCardText(card: MeasureCard) {
  const { t } = useApp();
  const planned = plannedPerDay(card.plan);
  const count = card.measurements.length;
  const done = count >= planned;
  const title = card.plan.name.trim() || t("body.captureTitle");
  const subtitle =
    count === 0
      ? t("measure.planned", { count: planned })
      : done
        ? t("measure.recorded", { count })
        : `${t("measure.planned", { count: planned })} · ${t("measure.soFar", { count })}`;
  return { title, subtitle, done, count };
}

/**
 * Eine Karte pro Messplan, im Aufbau wie eine Trainingszeile auf Heute: links Name und Stand,
 * rechts der Status. Offen: Knopf „Erfassen“. Erledigt: Name durchgestrichen und Haken – ohne Knopf;
 * ein Tipp auf die Zeile erlaubt trotzdem eine weitere Messung (kein Zwang, keine harte Grenze).
 */
export function MeasureCardRow({ card, onCapture }: { card: MeasureCard; onCapture: () => void }) {
  const { t } = useApp();
  const { title, subtitle, done } = useMeasureCardText(card);
  const label = `${t("progress.capture")}: ${title}`;
  const text = (
    <span className="min-w-0">
      <span className={done ? "block truncate font-bold text-muted line-through" : "block truncate font-bold"}>{title}</span>
      <span className="block truncate text-xs text-subtle">{subtitle}</span>
    </span>
  );

  if (done) {
    return (
      <button
        type="button"
        onClick={onCapture}
        aria-label={label}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-elevated px-4 py-3 text-left"
      >
        {text}
        <CircleCheck size={20} className="shrink-0 text-success" aria-hidden />
      </button>
    );
  }
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-elevated py-2 pl-4 pr-2">
      {text}
      <button
        type="button"
        onClick={onCapture}
        aria-label={label}
        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-accent px-3.5 text-sm font-extrabold text-black active:scale-[0.98]"
      >
        {t("progress.capture")}
      </button>
    </div>
  );
}
