import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { useToast } from "@/components/ui/toast";
import type { WorkoutPlan, WorkoutSession } from "@/domain/types";
import { startSessionFromPlan } from "@/services/workout-service";

/** Training aus einem Trainingstag starten – läuft schon eines, geht es dorthin. */
export function useStartPlan(active: WorkoutSession | undefined) {
  const { t } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const start = async (plan: WorkoutPlan, date?: Date) => {
    if (busy) return;
    if (active) {
      toast(t("training.activeExists"));
      navigate(`/training/session/${active.id}`);
      return;
    }
    setBusy(true);
    try {
      const session = await startSessionFromPlan(plan, date);
      navigate(`/training/session/${session.id}`);
    } finally {
      setBusy(false);
    }
  };

  return { start, busy };
}
