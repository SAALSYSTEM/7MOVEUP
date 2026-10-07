import { Plus } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { MeasureCardRow } from "@/components/body/measure-card";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { FieldHint } from "@/components/ui/label";
import { measureCardsForDate } from "@/domain/measure-plans";
import type { MeasurePlan } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { useToday } from "@/hooks/use-today";

/** Erfassen: oben die für heute geplanten Messungen, darunter jederzeit eine freie Messung. */
export function CapturePage() {
  const { t } = useApp();
  const today = useToday();
  const body = useBodyData();
  const [sheet, setSheet] = useState<{ plan?: MeasurePlan } | null>(null);
  const cards = body.loaded ? measureCardsForDate(body.bodySettings?.plans ?? [], body.measurements, today).cards : [];

  return (
    <Page>
      <SubHeader title={t("capture.title")} fallback="/progress" />

      <section aria-labelledby="capture-today">
        <SectionTitle id="capture-today">{t("capture.today")}</SectionTitle>
        {cards.length > 0 ? (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li key={card.plan.id}>
                <MeasureCardRow card={card} onCapture={() => setSheet({ plan: card.plan })} />
              </li>
            ))}
          </ul>
        ) : (
          body.loaded && <Card className="p-4 text-sm text-muted">{t("capture.nothing")}</Card>
        )}
      </section>

      <section className="mt-8">
        <Button variant="secondary" className="w-full" onClick={() => setSheet({})}>
          <Plus size={17} aria-hidden /> {t("capture.free")}
        </Button>
        <FieldHint>{t("capture.freeHint")}</FieldHint>
      </section>

      <MeasurementSheet open={sheet !== null} plan={sheet?.plan} onClose={() => setSheet(null)} />
    </Page>
  );
}
