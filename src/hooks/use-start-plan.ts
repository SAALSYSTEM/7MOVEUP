import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { useToast } from "@/components/ui/toast";
import type { WorkoutPlan } from "@/domain/types";
import { startSessionFromPlan } from "@/services/workout-service";

/**
 * Training aus einem Trainingstag starten – der eine gemeinsame Weg für Heute, Training und Kalender.
 * Läuft schon ein Training, geht es dorthin (bei einem anderen Tag mit Hinweis); eine zweite offene
 * Session entsteht nie. Die Sperre per Ref wirkt sofort und fängt schnelles Doppeltippen ab.
 */
export function useStartPlan() {
  const { t } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);

  const start = async (plan: WorkoutPlan, date?: Date) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const { session, created } = await startSessionFromPlan(plan, date);
      if (!created && session.planId !== plan.id) toast(t("training.activeExists"));
      navigate(`/training/session/${session.id}`);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return { start, busy };
}
