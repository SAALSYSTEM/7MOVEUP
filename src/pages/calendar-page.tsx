import { useMemo, useState } from "react";


import { useApp } from "@/app/app-context";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { CalendarView } from "@/components/training/calendar-view";
import { exerciseRepository, planRepository, workoutRepository } from "@/data";
import { useBodyData } from "@/hooks/use-body-data";
import { useData } from "@/hooks/use-data";
import type { BodyMeasurement, MeasurePlan } from "@/domain/types";
import { useStartPlan } from "@/hooks/use-start-plan";

/** Kalender ohne eigenen Navigationspunkt (Einstieg über Heute): Trainings und Körperwerte. */
export function CalendarPage() {
  const { t } = useApp();
  const body = useBodyData();
  const [capture, setCapture] = useState<{ date: string; plan?: MeasurePlan; measurement?: BodyMeasurement } | null>(null);
  const { data } = useData(async () => {
    const [plans, completed, exercises] = await Promise.all([
      planRepository.getAll(),
      workoutRepository.getCompletedSessions(),
      exerciseRepository.getAll(),
    ]);
    return { plans, completed, exercises };
  });
  const exercisesById = useMemo(() => new Map((data?.exercises ?? []).map((e) => [e.id, e])), [data]);
  const { start, busy } = useStartPlan();

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
          measurePlans={body.bodySettings?.plans ?? []}
          onOpenMeasurement={(date, target) => setCapture({ date, ...target })}
        />
      )}
      <MeasurementSheet
        open={capture !== null}
        date={capture?.date}
        plan={capture?.plan}
        measurement={capture?.measurement}
        onClose={() => setCapture(null)}
      />
    </Page>
  );
}
