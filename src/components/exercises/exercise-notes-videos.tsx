import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useApp } from "@/app/app-context";
import { VideoEmbed } from "@/components/exercises/video-embed";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository } from "@/data";
import type { Exercise, ExerciseNote } from "@/domain/types";
import { exerciseName } from "@/i18n";
import { cn } from "@/lib/utils";
import { isSafeHttpUrl } from "@/lib/video";

type Props = {
  exercise: Exercise;
  note: ExerciseNote | undefined;
  /** nach jeder gespeicherten Änderung – z. B. damit das laufende Training neu lädt */
  onChanged?: () => void;
  className?: string;
};

/**
 * Eigene Notiz und Video-Links zu einer Übung: anzeigen, bearbeiten, hinzufügen.
 * Genutzt im Übungsdetail und im Training (Info-Sheet). Gilt für die Übung in allen Trainings.
 */
export function ExerciseNotesVideos({ exercise, note, onChanged, className }: Props) {
  const { t, language } = useApp();
  const toast = useToast();
  const uid = useId();
  const ids = { note: `${uid}-note`, noteTitle: `${uid}-note-title`, videosTitle: `${uid}-videos-title`, url: `${uid}-url` };

  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [videoDraft, setVideoDraft] = useState("");
  const [videoError, setVideoError] = useState<string>();

  const name = exerciseName(exercise, language);
  const ownVideos = note?.videoUrls ?? [];
  const savedNote = note?.note ?? "";
  const noteValue = noteDraft ?? savedNote;
  const noteDirty = noteDraft !== null && noteDraft.trim() !== savedNote;

  // Sicherheitsnetz: Wird das Sheet/die Seite mit offener Tastatur geschlossen, gibt es auf iOS
  // kein blur – ungespeicherte Notiz dann beim Verlassen sichern.
  const pending = useRef({ dirty: false, value: "", onChanged });
  useEffect(() => {
    pending.current = { dirty: noteDirty, value: noteValue, onChanged };
  });
  useEffect(() => {
    const exerciseId = exercise.id;
    return () => {
      const { dirty, value, onChanged: changed } = pending.current;
      if (!dirty) return;
      void exerciseRepository
        .saveNote(exerciseId, { note: value.trim() })
        .then(() => changed?.())
        .catch(console.error);
    };
  }, [exercise.id]);

  const saveNote = async () => {
    if (!noteDirty) {
      setNoteDraft(null);
      return;
    }
    await exerciseRepository.saveNote(exercise.id, { note: noteValue.trim() });
    setNoteDraft(null);
    toast(t("exercise.noteSaved"));
    onChanged?.();
  };

  const addVideo = async () => {
    const url = videoDraft.trim();
    if (!isSafeHttpUrl(url)) {
      setVideoError(t("exercise.invalidUrl"));
      return;
    }
    setVideoError(undefined);
    if (exercise.builtIn) {
      await exerciseRepository.saveNote(exercise.id, { videoUrls: [...ownVideos, url] });
    } else {
      await exerciseRepository.saveCustom({ ...exercise, videoUrls: [...(exercise.videoUrls ?? []), url] });
    }
    setVideoDraft("");
    toast(t("common.saved"));
    onChanged?.();
  };

  const removeOwnVideo = async (url: string) => {
    await exerciseRepository.saveNote(exercise.id, { videoUrls: ownVideos.filter((v) => v !== url) });
    onChanged?.();
  };

  const removeCustomVideo = async (url: string) => {
    await exerciseRepository.saveCustom({ ...exercise, videoUrls: (exercise.videoUrls ?? []).filter((v) => v !== url) });
    onChanged?.();
  };

  return (
    <div className={cn("space-y-7", className)}>
      <section aria-labelledby={ids.noteTitle}>
        <SectionTitle id={ids.noteTitle}>{t("exercise.note")}</SectionTitle>
        <label htmlFor={ids.note} className="sr-only">
          {t("exercise.note")}
        </label>
        <Textarea
          id={ids.note}
          value={noteValue}
          placeholder={t("exercise.notePlaceholder")}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => void saveNote()}
        />
        {noteDirty && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={() => void saveNote()}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby={ids.videosTitle}>
        <SectionTitle id={ids.videosTitle}>{t("exercise.videos")}</SectionTitle>
        <div className="space-y-3">
          {(exercise.videoUrls ?? []).map((url) => (
            <VideoEmbed
              key={url}
              url={url}
              title={name}
              sourceLabel={exercise.builtIn ? t("exercise.builtInVideo") : undefined}
              onRemove={exercise.builtIn ? undefined : () => void removeCustomVideo(url)}
            />
          ))}
          {ownVideos.map((url) => (
            <VideoEmbed key={url} url={url} title={name} sourceLabel={t("exercise.myVideo")} onRemove={() => void removeOwnVideo(url)} />
          ))}
          {!exercise.videoUrls?.length && ownVideos.length === 0 && <p className="text-sm text-muted">{t("exercise.noVideos")}</p>}
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addVideo();
          }}
        >
          <Label htmlFor={ids.url}>{t("exercise.addVideo")}</Label>
          <div className="flex gap-2">
            <Input
              id={ids.url}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={videoDraft}
              onChange={(e) => {
                setVideoDraft(e.target.value);
                setVideoError(undefined);
              }}
              placeholder={t("exercise.videoPlaceholder")}
              aria-invalid={Boolean(videoError)}
            />
            <Button
              type="submit"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-2xl"
              aria-label={t("exercise.addVideo")}
              disabled={!videoDraft.trim()}
            >
              <Plus size={20} aria-hidden />
            </Button>
          </div>
          <FieldError>{videoError}</FieldError>
        </form>
      </section>
    </div>
  );
}
