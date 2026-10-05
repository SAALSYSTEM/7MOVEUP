import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { Segmented } from "@/components/ui/segmented";

type TrainingTab = "plan" | "exercises";

/** Unterbereiche von Training: Plan · Übungen (die Übungsbibliothek liegt unter Training). */
export function TrainingTabs({ value, className }: { value: TrainingTab; className?: string }) {
  const { t } = useApp();
  const navigate = useNavigate();
  return (
    <Segmented<TrainingTab>
      ariaLabel={t("training.title")}
      layoutId="training-tabs"
      value={value}
      onChange={(next) => {
        if (next !== value) navigate(next === "plan" ? "/training" : "/exercises");
      }}
      options={[
        { value: "plan", label: t("training.tabPlan"), id: "tab-plan" },
        { value: "exercises", label: t("training.tabExercises"), id: "tab-exercises" },
      ]}
      className={className ?? "mb-6"}
    />
  );
}
