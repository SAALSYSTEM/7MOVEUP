import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { MeasurementSheet } from "@/components/body/measurement-sheet";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { WeekdayPicker } from "@/components/training/weekday-picker";
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
import { MAX_PER_DAY } from "@/domain/measure-plans";
import type { BodySettings, CustomBodyMetric, MeasurePlan, UnitSystem, Weekday } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { createId } from "@/lib/id";

type Editing = { mode: "new" } | { mode: "edit"; custom: CustomBodyMetric };

/** Messwerte verwalten: aktivieren, sortieren, eigene ergänzen, Einheiten, Messtage. */
export function MetricsPage() {
  const { t, language } = useApp();
  const toast = useToast();
  const body = useBodyData();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MeasurePlan | "new" | null>(null);
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

  const plans = settings.plans ?? [];
  const savePlans = (next: MeasurePlan[]) => save({ plans: next });

  const unitLabel = (metric: MetricView) => (metric.unit ? metric.unit : t("metrics.noUnit"));

  return (
    <Page>
      <SubHeader
        title={t("metrics.title")}
        fallback="/progress"
        action={
          <Button size="sm" onClick={() => setCaptureOpen(true)}>
            <Plus size={16} aria-hidden /> {t("progress.capture")}
          </Button>
        }
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

      <section className="mt-8" aria-labelledby="metrics-plans-title">
        <SectionTitle id="metrics-plans-title">{t("metrics.plansTitle")}</SectionTitle>
        <p className="-mt-1 mb-3 text-sm leading-relaxed text-muted">{t("metrics.plansHint")}</p>
        {plans.length > 0 && (
          <Card className="divide-y divide-line">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setEditingPlan(plan)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-label={`${t("common.edit")}: ${plan.name || t("calendar.bodyLogged")}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{plan.name || t("calendar.bodyLogged")}</span>
                  <span className="block truncate text-xs text-subtle">
                    {[
                      [...plan.weekdays].sort().map((d) => t(`weekday.${d}`)).join(" "),
                      plan.perDay > 1 ? t("metrics.planPerDayN", { count: plan.perDay }) : undefined,
                      t("metrics.planValues", { count: planMetricCount(plan, body.metrics) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Pencil size={14} className="shrink-0 text-subtle" aria-hidden />
              </button>
            ))}
          </Card>
        )}
        {plans.length === 0 && <p className="mb-3 text-sm text-subtle">{t("metrics.plansEmpty")}</p>}
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setEditingPlan("new")}>
          <Plus size={16} aria-hidden /> {t("metrics.addPlan")}
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
      <PlanSheet
        editing={editingPlan}
        metrics={body.metrics}
        onClose={() => setEditingPlan(null)}
        onSave={(plan) => {
          savePlans(plans.some((p) => p.id === plan.id) ? plans.map((p) => (p.id === plan.id ? plan : p)) : [...plans, plan]);
          setEditingPlan(null);
          toast(t("common.saved"));
        }}
        onDelete={(id) => {
          savePlans(plans.filter((p) => p.id !== id));
          setEditingPlan(null);
        }}
      />
      <MeasurementSheet open={captureOpen} onClose={() => setCaptureOpen(false)} />
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

/** Anzahl der Messwerte eines Plans (nur aktive; ohne Auswahl = alle aktiven) */
function planMetricCount(plan: MeasurePlan, metrics: MetricView[]) {
  return metrics.filter((m) => m.enabled && (!plan.metricKeys || plan.metricKeys.includes(m.key))).length;
}

function PlanSheet({
  editing,
  metrics,
  onClose,
  onSave,
  onDelete,
}: {
  editing: MeasurePlan | "new" | null;
  metrics: MetricView[];
  onClose: () => void;
  onSave: (plan: MeasurePlan) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useApp();
  const current = editing && editing !== "new" ? editing : undefined;
  return (
    <Sheet open={Boolean(editing)} onClose={onClose} title={current ? t("metrics.editPlan") : t("metrics.addPlan")} tall>
      {editing && <PlanForm key={current?.id ?? "new"} current={current} metrics={metrics} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function PlanForm({
  current,
  metrics,
  onSave,
  onDelete,
}: {
  current?: MeasurePlan;
  metrics: MetricView[];
  onSave: (plan: MeasurePlan) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useApp();
  const available = metrics.filter((m) => m.enabled);
  const [name, setName] = useState(current?.name ?? "");
  const [keys, setKeys] = useState<string[]>(() =>
    current ? available.filter((m) => !current.metricKeys || current.metricKeys.includes(m.key)).map((m) => m.key) : [],
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(current?.weekdays ?? []);
  const [perDay, setPerDay] = useState(current?.perDay ?? 1);
  const valid = keys.length > 0 && weekdays.length > 0;

  const submit = () => {
    if (!valid) return;
    onSave({
      id: current?.id ?? createId(),
      name: name.trim().slice(0, 60),
      metricKeys: available.filter((m) => keys.includes(m.key)).map((m) => m.key),
      weekdays,
      perDay,
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
        <Label htmlFor="plan-name">{t("metrics.planName")}</Label>
        <Input
          id="plan-name"
          value={name}
          maxLength={60}
          placeholder={t("metrics.planNamePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <p id="plan-metrics" className="mb-2 text-sm font-bold">
          {t("metrics.planMetrics")}
        </p>
        <Card className="divide-y divide-line" role="group" aria-labelledby="plan-metrics">
          {available.map((metric) => (
            <div key={metric.key} className="flex items-center gap-3 py-2 pl-4 pr-3">
              <span className="min-w-0 flex-1 truncate font-semibold">{metric.name}</span>
              <Switch
                checked={keys.includes(metric.key)}
                onCheckedChange={(on) => setKeys((prev) => (on ? [...prev, metric.key] : prev.filter((k) => k !== metric.key)))}
                aria-label={metric.name}
              />
            </div>
          ))}
        </Card>
      </div>
      <div>
        <p id="plan-days" className="mb-2 text-sm font-bold">
          {t("metrics.planDays")}
        </p>
        <WeekdayPicker value={weekdays} onChange={setWeekdays} labelledBy="plan-days" />
      </div>
      <div>
        <p id="plan-per-day" className="mb-2 text-sm font-bold">
          {t("metrics.planPerDay")}
        </p>
        <Segmented<string>
          role="radio"
          ariaLabel={t("metrics.planPerDay")}
          layoutId="plan-per-day"
          value={String(perDay)}
          onChange={(value) => setPerDay(Number(value))}
          options={Array.from({ length: MAX_PER_DAY }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
        />
      </div>
      {!valid && <FieldHint>{t("metrics.planNeed")}</FieldHint>}
      <Button type="submit" className="w-full" disabled={!valid}>
        {t("common.save")}
      </Button>
      {current && (
        <div className="text-center">
          <Button variant="ghost" className="w-full text-danger" onClick={() => onDelete(current.id)}>
            {t("metrics.deletePlan")}
          </Button>
          <p className="text-xs text-subtle">{t("metrics.deletePlanHint")}</p>
        </div>
      )}
    </form>
  );
}
