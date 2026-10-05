import { useMemo, useState } from "react";

import { useApp } from "@/app/app-context";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { CalendarView } from "@/components/training/calendar-view";
import { exerciseRepository, planRepository, workoutRepository } from "@/data";
import { useBodyData } from "@/hooks/use-body-data";
import { useData } from "@/hooks/use-data";
import { useStartPlan } from "@/hooks/use-start-plan";

/** Kalender ohne eigenen Navigationspunkt (Einstieg über Heute): Trainings und Körperwerte. */
export function CalendarPage() {
  const { t } = useApp();
  const body = useBodyData();
  const [captureDate, setCaptureDate] = useState<string | null>(null);
  const { data } = useData(async () => {
    const [plans, completed, active, exercises] = await Promise.all([
      planRepository.getAll(),
      workoutRepository.getCompletedSessions(),
      workoutRepository.getActiveSession(),
      exerciseRepository.getAll(),
    ]);
    return { plans, completed, active, exercises };
  });
  const exercisesById = useMemo(() => new Map((data?.exercises ?? []).map((e) => [e.id, e])), [data]);
  const { start, busy } = useStartPlan(data?.active);

  return (
    <Page>
      <SubHeader title={t("calendar.title")} fallback="/" />
      {data && (
        <CalendarView
          plans={data.plans}
          completed={data.completed}
          exercisesById={exercisesById}
          onStart={(plan, date) => void start(plan, date)}
          canStart={!busy}
          measurements={body.measurements}
          metrics={body.metrics}
          onOpenMeasurement={setCaptureDate}
        />
      )}
      <MeasurementSheet open={captureDate !== null} date={captureDate ?? undefined} onClose={() => setCaptureDate(null)} />
    </Page>
  );
}
