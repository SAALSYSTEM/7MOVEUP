import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { WeekdayPicker } from "@/components/training/weekday-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { bodyRepository } from "@/data";
import type { MetricView } from "@/domain/body";
import { MAX_PER_DAY } from "@/domain/measure-plans";
import type { MeasurePlan, Weekday } from "@/domain/types";
import { useBodyData } from "@/hooks/use-body-data";
import { createId } from "@/lib/id";

/** Messpläne: was soll an welchen Tagen gemessen werden – nur eine Hilfe, kein Zwang. */
export function PlansPage() {
  const { t } = useApp();
  const toast = useToast();
  const body = useBodyData();
  const [editingPlan, setEditingPlan] = useState<MeasurePlan | "new" | null>(null);
  const settings = body.bodySettings;

  if (!settings) return <Page />;

  const plans = settings.plans ?? [];
  const savePlans = (next: MeasurePlan[]) => void bodyRepository.saveSettings({ plans: next });

  return (
    <Page>
      <SubHeader title={t("metrics.plansTitle")} fallback="/progress" />
      <p className="-mt-2 mb-4 text-sm leading-relaxed text-muted">{t("metrics.plansHint")}</p>
      {plans.length > 0 ? (
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
      ) : (
        <p className="mb-3 text-sm text-subtle">{t("metrics.plansEmpty")}</p>
      )}
      <Button variant="secondary" className="mt-3 w-full" onClick={() => setEditingPlan("new")}>
        <Plus size={16} aria-hidden /> {t("metrics.addPlan")}
      </Button>

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
    </Page>
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
        <p className="-mt-1 mb-2 text-xs text-subtle">{t("metrics.planMetricsHint")}</p>
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
