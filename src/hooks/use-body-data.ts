import { useMemo } from "react";

import { useApp } from "@/app/app-context";
import { bodyRepository } from "@/data";
import { resolveMetrics } from "@/domain/body";
import { useData } from "@/hooks/use-data";

/** Körperwerte samt Messwert-Liste in der eingestellten Einheit (metrisch/imperial). */
export function useBodyData() {
  const { language, settings } = useApp();
  const system = settings.unitSystem ?? "metric";
  const { data, loading } = useData(async () => {
    const [bodySettings, measurements] = await Promise.all([bodyRepository.getSettings(), bodyRepository.getMeasurements()]);
    return { bodySettings, measurements };
  });
  const metrics = useMemo(
    () => (data ? resolveMetrics(data.bodySettings, language, system) : []),
    [data, language, system],
  );
  return {
    loaded: Boolean(data) && !loading,
    bodySettings: data?.bodySettings,
    measurements: data?.measurements ?? [],
    metrics,
    system,
  };
}
