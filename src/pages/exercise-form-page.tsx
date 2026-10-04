import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { EmptyState, Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { useToast } from "@/components/ui/toast";
import { exerciseRepository } from "@/data";
import {
  BODY_REGIONS,
  EQUIPMENT,
  TRACKING_TYPES,
  type BodyRegion,
  type Equipment,
  type Exercise,
  type TrackingType,
} from "@/domain/types";
import { createId } from "@/lib/id";
import { isSafeHttpUrl } from "@/lib/video";

type FormState = {
  nameDe: string;
  nameEn: string;
  bodyRegions: BodyRegion[];
  equipment: Equipment[];
  trackingType: TrackingType;
  videoUrl: string;
  defaultSets?: number;
  defaultRepMin?: number;
  defaultRepMax?: number;
  defaultDurationSec?: number;
  defaultRestSec?: number;
  note: string;
};

const EMPTY: FormState = {
  nameDe: "",
  nameEn: "",
  bodyRegions: [],
  equipment: [],
  trackingType: "weight_reps",
  videoUrl: "",
  defaultSets: 3,
  defaultRepMin: 8,
  defaultRepMax: 12,
  defaultRestSec: 60,
  note: "",
};

type Errors = Partial<Record<"name" | "regions" | "equipment" | "video", string>>;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ExerciseFormPage() {
  const { exerciseId } = useParams();
  const isEdit = Boolean(exerciseId);
  const { t, language } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState<Exercise>();
  const [loaded, setLoaded] = useState(!isEdit);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!exerciseId) return;
    void Promise.all([exerciseRepository.getById(exerciseId), exerciseRepository.getNote(exerciseId)]).then(
      ([exercise, note]) => {
        if (exercise && !exercise.builtIn) {
          setExisting(exercise);
          setForm({
            nameDe: exercise.name.de,
            nameEn: exercise.name.en === exercise.name.de ? "" : exercise.name.en,
            bodyRegions: exercise.bodyRegions,
            equipment: exercise.equipment,
            trackingType: exercise.trackingType,
            videoUrl: "",
            defaultSets: exercise.defaultSets,
            defaultRepMin: exercise.defaultRepMin,
            defaultRepMax: exercise.defaultRepMax,
            defaultDurationSec: exercise.defaultDurationSec,
            defaultRestSec: exercise.defaultRestSec,
            note: note?.note ?? "",
          });
        }
        setLoaded(true);
      },
    );
  }, [exerciseId]);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  if (!loaded) return <Page withNav={false} />;
  if (isEdit && !existing) {
    return (
      <Page withNav={false}>
        <SubHeader fallback="/exercises" />
        <EmptyState title={t("exercise.notFound")} />
      </Page>
    );
  }

  const validate = (): Errors => {
    const next: Errors = {};
    if (!form.nameDe.trim() && !form.nameEn.trim()) next.name = t("exerciseForm.nameRequired");
    if (form.bodyRegions.length === 0) next.regions = t("exerciseForm.regionRequired");
    if (form.equipment.length === 0) next.equipment = t("exerciseForm.equipmentRequired");
    if (form.videoUrl.trim() && !isSafeHttpUrl(form.videoUrl)) next.video = t("exercise.invalidUrl");
    return next;
  };

  const save = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const nameDe = form.nameDe.trim() || form.nameEn.trim();
      const nameEn = form.nameEn.trim() || nameDe;
      const repBased = form.trackingType === "weight_reps" || form.trackingType === "reps";
      const timeBased = form.trackingType === "duration" || form.trackingType === "cardio";
      const videoUrls = [...(existing?.videoUrls ?? [])];
      if (form.videoUrl.trim()) videoUrls.push(form.videoUrl.trim());
      const saved = await exerciseRepository.saveCustom({
        id: existing?.id ?? `custom-${createId()}`,
        builtIn: false,
        name: { de: nameDe, en: nameEn },
        bodyRegions: form.bodyRegions,
        equipment: form.equipment,
        trackingType: form.trackingType,
        defaultSets: form.trackingType === "cardio" ? 1 : form.defaultSets,
        defaultRepMin: repBased ? form.defaultRepMin : undefined,
        defaultRepMax: repBased ? (form.defaultRepMax ?? form.defaultRepMin) : undefined,
        defaultDurationSec: timeBased ? form.defaultDurationSec : undefined,
        defaultRestSec: form.trackingType === "cardio" ? undefined : form.defaultRestSec,
        videoUrls: videoUrls.length ? videoUrls : undefined,
        createdAt: existing?.createdAt,
      });
      const previousNote = (await exerciseRepository.getNote(saved.id))?.note ?? "";
      if (form.note.trim() !== previousNote) await exerciseRepository.saveNote(saved.id, { note: form.note.trim() });
      toast(t("common.saved"));
      navigate(`/exercises/${encodeURIComponent(saved.id)}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const repBased = form.trackingType === "weight_reps" || form.trackingType === "reps";

  return (
    <Page withNav={false}>
      <SubHeader title={isEdit ? t("exerciseForm.editTitle") : t("exerciseForm.newTitle")} fallback="/exercises" />

      <form
        className="space-y-7"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="name-de">{t("exerciseForm.nameDe")}</Label>
            <Input
              id="name-de"
              value={form.nameDe}
              onChange={(e) => set({ nameDe: e.target.value })}
              aria-invalid={Boolean(errors.name)}
              autoFocus={!isEdit && language === "de"}
            />
          </div>
          <div>
            <Label htmlFor="name-en">
              {t("exerciseForm.nameEn")} <span className="normal-case tracking-normal text-subtle">({t("common.optional")})</span>
            </Label>
            <Input id="name-en" value={form.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
          </div>
          <FieldError>{errors.name}</FieldError>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("exerciseForm.regions")}</legend>
          <div className="flex flex-wrap gap-2">
            {BODY_REGIONS.map((region) => (
              <Chip key={region} active={form.bodyRegions.includes(region)} onClick={() => set({ bodyRegions: toggle(form.bodyRegions, region) })}>
                {t(`region.${region}`)}
              </Chip>
            ))}
          </div>
          <FieldError>{errors.regions}</FieldError>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("exerciseForm.equipment")}</legend>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((equipment) => (
              <Chip key={equipment} active={form.equipment.includes(equipment)} onClick={() => set({ equipment: toggle(form.equipment, equipment) })}>
                {t(`equipment.${equipment}`)}
              </Chip>
            ))}
          </div>
          <FieldError>{errors.equipment}</FieldError>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("exerciseForm.tracking")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("exerciseForm.tracking")}>
            {TRACKING_TYPES.map((tracking) => (
              <Chip
                key={tracking}
                role="radio"
                aria-checked={form.trackingType === tracking}
                aria-pressed={undefined}
                active={form.trackingType === tracking}
                onClick={() =>
                  set({
                    trackingType: tracking,
                    defaultDurationSec:
                      tracking === "cardio" ? (form.defaultDurationSec ?? 1800) : tracking === "duration" ? (form.defaultDurationSec ?? 30) : form.defaultDurationSec,
                  })
                }
              >
                {t(`tracking.${tracking}`)}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {t("exerciseForm.defaults")} <span className="normal-case tracking-normal text-subtle">({t("common.optional")})</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {form.trackingType !== "cardio" && (
              <NumberField label={t("common.sets")} value={form.defaultSets} min={1} max={20} onChange={(v) => set({ defaultSets: v })} />
            )}
            {repBased && (
              <>
                <NumberField label={t("plan.repMin")} value={form.defaultRepMin} max={200} onChange={(v) => set({ defaultRepMin: v })} />
                <NumberField label={t("plan.repMax")} value={form.defaultRepMax} max={200} onChange={(v) => set({ defaultRepMax: v })} />
              </>
            )}
            {form.trackingType === "duration" && (
              <NumberField label={t("plan.duration")} value={form.defaultDurationSec} max={3600} onChange={(v) => set({ defaultDurationSec: v })} />
            )}
            {form.trackingType === "cardio" && (
              <NumberField
                label={t("plan.durationMin")}
                value={form.defaultDurationSec == null ? undefined : Math.round(form.defaultDurationSec / 60)}
                max={600}
                onChange={(v) => set({ defaultDurationSec: v == null ? undefined : v * 60 })}
              />
            )}
            {form.trackingType !== "cardio" && (
              <NumberField label={t("plan.restSec")} value={form.defaultRestSec} max={900} onChange={(v) => set({ defaultRestSec: v })} />
            )}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="video">
            {t("exerciseForm.video")} <span className="normal-case tracking-normal text-subtle">({t("common.optional")})</span>
          </Label>
          <Input
            id="video"
            type="url"
            inputMode="url"
            value={form.videoUrl}
            placeholder={t("exercise.videoPlaceholder")}
            onChange={(e) => set({ videoUrl: e.target.value })}
            aria-invalid={Boolean(errors.video)}
          />
          {existing?.videoUrls?.length ? (
            <p className="mt-2 text-xs text-subtle">
              {existing.videoUrls.length} × {t("exercise.videos")}
            </p>
          ) : null}
          <FieldError>{errors.video}</FieldError>
        </div>

        <div>
          <Label htmlFor="note">
            {t("exerciseForm.note")} <span className="normal-case tracking-normal text-subtle">({t("common.optional")})</span>
          </Label>
          <Textarea id="note" value={form.note} placeholder={t("exercise.notePlaceholder")} onChange={(e) => set({ note: e.target.value })} />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl">
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </form>
    </Page>
  );
}
