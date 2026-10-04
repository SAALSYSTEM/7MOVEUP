import type { BodyRegion, Equipment, Exercise, Language, TrackingType } from "@/domain/types";
import { exerciseName } from "@/i18n";

export type ExerciseFilter = {
  query: string;
  region?: BodyRegion;
  equipment?: Equipment;
  tracking?: TrackingType;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

export function filterExercises(exercises: Exercise[], filter: ExerciseFilter, language: Language): Exercise[] {
  const query = normalize(filter.query.trim());
  return exercises
    .filter((exercise) => {
      if (filter.region && !exercise.bodyRegions.includes(filter.region)) return false;
      if (filter.equipment && !exercise.equipment.includes(filter.equipment)) return false;
      if (filter.tracking && exercise.trackingType !== filter.tracking) return false;
      if (query) {
        const haystack = normalize(`${exercise.name.de} ${exercise.name.en}`);
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => exerciseName(a, language).localeCompare(exerciseName(b, language), language));
}
