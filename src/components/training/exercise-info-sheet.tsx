import { useApp } from "@/app/app-context";
import { ExerciseNotesVideos } from "@/components/exercises/exercise-notes-videos";
import { Sheet } from "@/components/ui/sheet";
import type { Exercise, ExerciseNote } from "@/domain/types";
import { exerciseName } from "@/i18n";
import { dismissKeyboard } from "@/lib/viewport";

type Props = {
  open: boolean;
  onClose: () => void;
  exercise: Exercise | undefined;
  note: ExerciseNote | undefined;
  onChanged: () => void;
};

/** Notiz und Videos einer Übung mitten im Training – ohne das Training (und den Pausen-Timer) zu verlassen. */
export function ExerciseInfoSheet({ open, onClose, exercise, note, onChanged }: Props) {
  const { t, language } = useApp();
  return (
    <Sheet
      open={open && Boolean(exercise)}
      onClose={() => {
        dismissKeyboard(); // Notiz-Feld gibt den Fokus ab → speichert
        onClose();
      }}
      title={exercise ? exerciseName(exercise, language) : ""}
      description={t("session.infoHint")}
    >
      {exercise && <ExerciseNotesVideos key={exercise.id} exercise={exercise} note={note} onChanged={onChanged} className="pt-1" />}
    </Sheet>
  );
}
