import { Plus, SearchX } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { filterExercises, type ExerciseFilter } from "@/components/exercises/exercise-filter";
import { ExerciseFilters } from "@/components/exercises/exercise-filters";
import { ExerciseRow } from "@/components/exercises/exercise-row";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { EmptyState, Page } from "@/components/layout/page";
import { TrainingTabs } from "@/components/training/training-tabs";
import { Button } from "@/components/ui/button";
import { exerciseRepository } from "@/data";
import { BODY_REGIONS, EQUIPMENT, TRACKING_TYPES, type BodyRegion, type Equipment, type TrackingType } from "@/domain/types";
import { useData } from "@/hooks/use-data";

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function ExercisesPage() {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Filter liegen in der URL, damit sie beim Zurückkehren aus dem Detail erhalten bleiben.
  const filter: ExerciseFilter = {
    query: params.get("q") ?? "",
    region: pick<BodyRegion>(params.get("region"), BODY_REGIONS),
    equipment: pick<Equipment>(params.get("equipment"), EQUIPMENT),
    tracking: pick<TrackingType>(params.get("tracking"), TRACKING_TYPES),
  };

  const setFilter = (next: ExerciseFilter) => {
    const search = new URLSearchParams();
    if (next.query) search.set("q", next.query);
    if (next.region) search.set("region", next.region);
    if (next.equipment) search.set("equipment", next.equipment);
    if (next.tracking) search.set("tracking", next.tracking);
    setParams(search, { replace: true });
  };

  const { data } = useData(async () => {
    const [exercises, notes] = await Promise.all([exerciseRepository.getAll(), exerciseRepository.getNotes()]);
    return { exercises, notes };
  });

  const notesById = useMemo(() => new Map((data?.notes ?? []).map((n) => [n.exerciseId, n])), [data]);
  const filtered = filterExercises(data?.exercises ?? [], filter, language);
  const hasFilter = Boolean(filter.query || filter.region || filter.equipment || filter.tracking);

  return (
    <Page>
      <AppHeader left={<PageTitle>{t("training.title")}</PageTitle>} />
      <TrainingTabs value="exercises" />

      <ExerciseFilters filter={filter} onChange={setFilter} />

      <div className="mb-3 mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted" aria-live="polite">
          {t("exercises.count", { count: filtered.length })}
        </p>
        <Button size="sm" variant="secondary" onClick={() => navigate("/exercises/new")}>
          <Plus size={16} aria-hidden /> {t("exercises.new")}
        </Button>
      </div>

      {data && filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX size={28} aria-hidden />}
          title={t("exercises.noResults")}
          action={
            hasFilter ? (
              <Button size="sm" variant="outline" onClick={() => setFilter({ query: "" })}>
                {t("exercises.resetFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((exercise) => {
            const note = notesById.get(exercise.id);
            return (
              <li key={exercise.id}>
                <ExerciseRow
                  exercise={exercise}
                  hasNote={Boolean(note?.note.trim())}
                  hasVideo={Boolean(exercise.videoUrls?.length || note?.videoUrls?.length)}
                  onClick={() => navigate(`/exercises/${encodeURIComponent(exercise.id)}`)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
