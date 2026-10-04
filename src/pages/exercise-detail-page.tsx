import { format } from "date-fns";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { VideoEmbed } from "@/components/exercises/video-embed";
import { EmptyState, Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/chip";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository, workoutRepository } from "@/data";
import { exerciseName } from "@/i18n";
import { dateLocale, parseDateKey } from "@/lib/dates";
import { exerciseDefaultsSummary, formatSeconds } from "@/lib/exercise-format";
import { formatPerformance } from "@/lib/performance-format";
import { useData } from "@/hooks/use-data";
import { isSafeHttpUrl } from "@/lib/video";

export function ExerciseDetailPage() {
  const { exerciseId = "" } = useParams();
  const { t, language } = useApp();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading } = useData(async () => {
    const [exercise, note, last] = await Promise.all([
      exerciseRepository.getById(exerciseId),
      exerciseRepository.getNote(exerciseId),
      workoutRepository.getLastPerformance(exerciseId),
    ]);
    return { exercise, note, last };
  }, [exerciseId]);

  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [videoDraft, setVideoDraft] = useState("");
  const [videoError, setVideoError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!data && loading) return <Page />;
  const exercise = data?.exercise;
  if (!exercise) {
    return (
      <Page>
        <SubHeader fallback="/exercises" />
        <EmptyState title={t("exercise.notFound")} />
      </Page>
    );
  }

  const name = exerciseName(exercise, language);
  const ownVideos = data?.note?.videoUrls ?? [];
  const defaults = exerciseDefaultsSummary(exercise, t);
  const last = data?.last;

  const savedNote = data?.note?.note ?? "";
  const noteValue = noteDraft ?? savedNote;
  const noteDirty = noteDraft !== null && noteDraft.trim() !== savedNote;

  const saveNote = async () => {
    if (!noteDirty) {
      setNoteDraft(null);
      return;
    }
    await exerciseRepository.saveNote(exercise.id, { note: noteValue.trim() });
    setNoteDraft(null);
    toast(t("exercise.noteSaved"));
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
  };

  const removeOwnVideo = async (url: string) => {
    await exerciseRepository.saveNote(exercise.id, { videoUrls: ownVideos.filter((v) => v !== url) });
  };

  const removeCustomVideo = async (url: string) => {
    await exerciseRepository.saveCustom({ ...exercise, videoUrls: (exercise.videoUrls ?? []).filter((v) => v !== url) });
  };

  const deleteExercise = async () => {
    await exerciseRepository.deleteCustom(exercise.id);
    navigate("/exercises", { replace: true });
  };

  const lastText = last ? formatPerformance(last.trackingType, last.sets, exercise, t, language) : undefined;

  return (
    <Page>
      <SubHeader
        fallback="/exercises"
        action={
          !exercise.builtIn ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate(`/exercises/${encodeURIComponent(exercise.id)}/edit`)}
              aria-label={t("common.edit")}
            >
              <Pencil size={18} aria-hidden />
            </Button>
          ) : undefined
        }
      />

      <h1 className="text-balance text-[30px] font-black leading-[1.02] tracking-[-0.035em]">{name}</h1>
      {language === "de" && exercise.name.en && exercise.name.en !== exercise.name.de && (
        <p className="mt-1 text-sm text-subtle">{exercise.name.en}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {exercise.bodyRegions.map((r) => (
          <Badge key={r}>{t(`region.${r}`)}</Badge>
        ))}
        {exercise.equipment.map((e) => (
          <Badge key={e} className="border-accent/25 text-accent-light">
            {t(`equipment.${e}`)}
          </Badge>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{t("exercises.tracking")}</p>
          <p className="mt-1 font-bold">{t(`tracking.${exercise.trackingType}`)}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{t("exercise.defaults")}</p>
          <p className="tabular mt-1 font-bold">
            {defaults ?? "–"}
            {exercise.defaultRestSec ? (
              <span className="ml-1 text-xs font-semibold text-subtle">
                · {formatSeconds(exercise.defaultRestSec, t)} {t("common.rest")}
              </span>
            ) : null}
          </p>
        </Card>
      </div>

      {lastText && last && (
        <Card className="mt-2 flex items-start gap-3 p-3.5">
          <History size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">
              {t("session.lastTime")} · {format(parseDateKey(last.date), language === "de" ? "d. MMM" : "MMM d", { locale: dateLocale(language) })}
            </p>
            {lastText.headline && <p className="mt-1 text-sm font-bold">{lastText.headline}</p>}
            <p className="tabular text-sm text-muted">{lastText.detail}</p>
          </div>
        </Card>
      )}

      <section className="mt-7" aria-labelledby="note-title">
        <SectionTitle id="note-title">{t("exercise.note")}</SectionTitle>
        <label htmlFor="exercise-note" className="sr-only">
          {t("exercise.note")}
        </label>
        <Textarea
          id="exercise-note"
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

      <section className="mt-7" aria-labelledby="videos-title">
        <SectionTitle id="videos-title">{t("exercise.videos")}</SectionTitle>
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
          {!exercise.videoUrls?.length && ownVideos.length === 0 && (
            <p className="text-sm text-muted">{t("exercise.noVideos")}</p>
          )}
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addVideo();
          }}
        >
          <Label htmlFor="video-url">{t("exercise.addVideo")}</Label>
          <div className="flex gap-2">
            <Input
              id="video-url"
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
            <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-2xl" aria-label={t("exercise.addVideo")} disabled={!videoDraft.trim()}>
              <Plus size={20} aria-hidden />
            </Button>
          </div>
          <FieldError>{videoError}</FieldError>
        </form>
      </section>

      {!exercise.builtIn && (
        <div className="mt-10">
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} aria-hidden /> {t("exercise.delete")}
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("exercise.delete")}
        description={t("exercise.deleteConfirm")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => void deleteExercise()}
      />
    </Page>
  );
}
