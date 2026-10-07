import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { bodyRepository, settingsRepository } from "@/data";
import { CUSTOM_METRIC_PREFIX, CUSTOM_STEPS, formatNumber, type MetricView } from "@/domain/body";
import { metricHasValues } from "@/domain/body-stats";
import type { BodySettings, CustomBodyMetric, UnitSystem } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { createId } from "@/lib/id";

type Editing = { mode: "new" } | { mode: "edit"; custom: CustomBodyMetric };

/** Messwerte verwalten: aktivieren, sortieren, eigene ergänzen, Einheiten. (Messpläne: eigene Seite.) */
export function MetricsPage() {
  const { t, language } = useApp();
  const toast = useToast();
  const body = useBodyData();
  const [editing, setEditing] = useState<Editing | null>(null);
  const settings = body.bodySettings;

  if (!settings) return <Page />;

  const save = (patch: Partial<Pick<BodySettings, "metrics" | "custom" | "measureWeekdays" | "plans">>) =>
    void bodyRepository.saveSettings(patch);

  // Reihenfolge = gespeicherte Liste (normalisiert)
  const order = body.metrics.map((m) => ({ key: m.key, enabled: m.enabled }));

  // Pläne ohne feste Auswahl (übernommener alter Messtage-Satz) merken sich ihre bisherigen Werte –
  // ein neu aktivierter oder neuer eigener Messwert gehört erst dazu, wenn er im Plan angehakt wird
  const frozenPlans = () => {
    const current = settings.plans ?? [];
    if (current.every((p) => p.metricKeys)) return {};
    const keys = order.filter((m) => m.enabled).map((m) => m.key);
    return { plans: current.map((p) => (p.metricKeys ? p : { ...p, metricKeys: keys })) };
  };

  const toggle = (key: string, enabled: boolean) =>
    save({ metrics: order.map((m) => (m.key === key ? { ...m, enabled } : m)), ...(enabled ? frozenPlans() : {}) });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    save({ metrics: next });
  };

  const unitLabel = (metric: MetricView) => (metric.unit ? metric.unit : t("metrics.noUnit"));

  return (
    <Page>
      <SubHeader
        title={t("metrics.title")}
        fallback="/progress"
      />

      <section aria-labelledby="metrics-list-title">
        <SectionTitle id="metrics-list-title">{t("metrics.listTitle")}</SectionTitle>
        <p className="-mt-1 mb-3 text-sm leading-relaxed text-muted">{t("metrics.listHint")}</p>
        <Card className="divide-y divide-line">
          {body.metrics.map((metric, index) => {
            const custom = settings.custom.find((c) => c.key === metric.key);
            return (
              <div key={metric.key} className="flex items-center gap-2 py-2 pl-4 pr-3">
                <div className="min-w-0 flex-1">
                  {custom ? (
                    <button
                      type="button"
                      onClick={() => setEditing({ mode: "edit", custom })}
                      className="flex max-w-full items-center gap-1.5 text-left"
                      aria-label={`${t("common.edit")}: ${metric.name}`}
                    >
                      <span className="truncate font-bold">{metric.name}</span>
                      <Pencil size={13} className="shrink-0 text-subtle" aria-hidden />
                    </button>
                  ) : (
                    <p className="truncate font-bold">{metric.name}</p>
                  )}
                  <p className="text-xs text-subtle">
                    {unitLabel(metric)}
                    {custom ? ` · ${t("metrics.own")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg disabled:opacity-25"
                  aria-label={t("metrics.moveUp", { name: metric.name })}
                >
                  <ChevronUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === body.metrics.length - 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg disabled:opacity-25"
                  aria-label={t("metrics.moveDown", { name: metric.name })}
                >
                  <ChevronDown size={18} aria-hidden />
                </button>
                <Switch
                  checked={metric.enabled}
                  onCheckedChange={(enabled) => toggle(metric.key, enabled)}
                  aria-label={t("metrics.track", { name: metric.name })}
                />
              </div>
            );
          })}
        </Card>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setEditing({ mode: "new" })}>
          <Plus size={16} aria-hidden /> {t("metrics.addOwn")}
        </Button>
      </section>

      <section className="mt-8" aria-labelledby="metrics-units-title">
        <SectionTitle id="metrics-units-title">{t("metrics.unitsTitle")}</SectionTitle>
        <Card className="p-4">
          <Segmented<UnitSystem>
            role="radio"
            ariaLabel={t("metrics.unitsTitle")}
            layoutId="metrics-units"
            value={body.system}
            onChange={(unitSystem) => void settingsRepository.update({ unitSystem })}
            options={[
              { value: "metric", label: t("units.metric") },
              { value: "imperial", label: t("units.imperial") },
            ]}
          />
          <FieldHint>{t("metrics.unitsHint")}</FieldHint>
        </Card>
      </section>

      <CustomMetricSheet
        editing={editing}
        hasValues={editing?.mode === "edit" ? metricHasValues(body.measurements, editing.custom.key) : false}
        language={language}
        onClose={() => setEditing(null)}
        onSave={(custom) => {
          if (editing?.mode === "edit") {
            save({ custom: settings.custom.map((c) => (c.key === custom.key ? custom : c)) });
          } else {
            save({ custom: [...settings.custom, custom], metrics: [...order, { key: custom.key, enabled: true }], ...frozenPlans() });
          }
          setEditing(null);
          toast(t("common.saved"));
        }}
        onDelete={(key) => {
          save({ custom: settings.custom.filter((c) => c.key !== key), metrics: order.filter((m) => m.key !== key) });
          setEditing(null);
        }}
      />
    </Page>
  );
}

function CustomMetricSheet({
  editing,
  hasValues,
  language,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Editing | null;
  hasValues: boolean;
  language: "de" | "en";
  onClose: () => void;
  onSave: (custom: CustomBodyMetric) => void;
  onDelete: (key: string) => void;
}) {
  const { t } = useApp();
  const current = editing?.mode === "edit" ? editing.custom : undefined;
  return (
    <Sheet open={Boolean(editing)} onClose={onClose} title={current ? t("metrics.editOwn") : t("metrics.addOwn")}>
      {editing && (
        <CustomMetricForm
          key={current?.key ?? "new"}
          current={current}
          hasValues={hasValues}
          language={language}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Sheet>
  );
}

function CustomMetricForm({
  current,
  hasValues,
  language,
  onSave,
  onDelete,
}: {
  current?: CustomBodyMetric;
  hasValues: boolean;
  language: "de" | "en";
  onSave: (custom: CustomBodyMetric) => void;
  onDelete: (key: string) => void;
}) {
  const { t } = useApp();
  const [name, setName] = useState(current?.name ?? "");
  const [unit, setUnit] = useState(current?.unit ?? "");
  const [step, setStep] = useState<number>(current?.step ?? 0.1);
  const unitLocked = Boolean(current && hasValues);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      key: current?.key ?? `${CUSTOM_METRIC_PREFIX}${createId()}`,
      name: trimmed.slice(0, 60),
      unit: unitLocked ? current!.unit : unit.trim().slice(0, 20),
      step,
      createdAt: current?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <form
      className="space-y-5 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label htmlFor="custom-metric-name">{t("metrics.name")}</Label>
        <Input
          id="custom-metric-name"
          value={name}
          maxLength={60}
          placeholder={t("metrics.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="custom-metric-unit">{t("metrics.unit")}</Label>
        <Input
          id="custom-metric-unit"
          value={unitLocked ? current!.unit : unit}
          maxLength={20}
          disabled={unitLocked}
          placeholder={t("metrics.unitPlaceholder")}
          onChange={(e) => setUnit(e.target.value)}
        />
        <FieldHint>{unitLocked ? t("metrics.unitLocked") : t("metrics.unitHint")}</FieldHint>
      </div>
      <div>
        <p id="custom-metric-step" className="mb-2 text-sm font-bold">
          {t("metrics.step")}
        </p>
        <Segmented<string>
          role="radio"
          ariaLabel={t("metrics.step")}
          layoutId="custom-metric-step"
          value={String(step)}
          onChange={(value) => setStep(Number(value))}
          options={CUSTOM_STEPS.map((s) => ({ value: String(s), label: `± ${formatNumber(s, s < 1 ? 1 : 0, language)}` }))}
        />
      </div>
      <Button type="submit" className="w-full" disabled={!name.trim()}>
        {t("common.save")}
      </Button>
      {current &&
        (hasValues ? (
          <p className="text-center text-xs text-subtle">{t("metrics.cannotDelete")}</p>
        ) : (
          <Button variant="ghost" className="w-full text-danger" onClick={() => onDelete(current.key)}>
            {t("metrics.deleteOwn")}
          </Button>
        ))}
    </form>
  );
}
