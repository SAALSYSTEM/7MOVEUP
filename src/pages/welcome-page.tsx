import { ArrowRight, Download, HardDrive, Lightbulb, Smartphone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "@/app/app-context";
import { Page } from "@/components/layout/page";
import { SubHeader } from "@/components/layout/sub-header";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { useBackupExport } from "@/hooks/use-backup";
import { isIOS } from "@/lib/device";
import { markWelcomeSeen } from "@/lib/welcome";

const STEPS = ["step1", "step2", "step3", "step4"] as const;
const TIPS = ["tip1", "tip2", "tip3"] as const;

/** „Neu hier?“ – kurze Erklärung, wichtigster Punkt: Daten liegen nur auf dem Gerät → Backup. */
export function WelcomePage() {
  const { t } = useApp();
  const navigate = useNavigate();
  const { exportBackup, busy } = useBackupExport();

  useEffect(() => markWelcomeSeen(), []);

  return (
    <Page>
      <SubHeader title={t("welcome.title")} fallback="/more" />

      <p className="mb-6 text-[15px] leading-relaxed text-muted">{t("welcome.intro")}</p>

      <section className="mb-6" aria-labelledby="welcome-steps">
        <SectionTitle id="welcome-steps">{t("welcome.stepsTitle")}</SectionTitle>
        <Card className="divide-y divide-line">
          {STEPS.map((step, index) => (
            <div key={step} className="flex gap-3 p-4">
              <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent-light">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-bold">{t(`welcome.${step}.title`)}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{t(`welcome.${step}.text`)}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section className="mb-6" aria-labelledby="welcome-data">
        <div className="rounded-[20px] border border-accent/40 bg-accent/10 p-4">
          <h2 id="welcome-data" className="flex items-center gap-2 font-black">
            <HardDrive size={18} className="shrink-0 text-accent" aria-hidden /> {t("welcome.dataTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed">{t("welcome.dataText")}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("welcome.dataTip")}</p>
          <Button className="mt-4 w-full" onClick={() => void exportBackup()} disabled={busy}>
            <Download size={18} aria-hidden /> {t("backup.create")}
          </Button>
        </div>
      </section>

      <Block icon={<Smartphone size={18} aria-hidden />} title={t("welcome.installTitle")}>
        {isIOS() ? t("welcome.installIos") : t("welcome.installOther")}
      </Block>

      <section className="mb-6" aria-labelledby="welcome-tips">
        <SectionTitle id="welcome-tips">{t("welcome.tipsTitle")}</SectionTitle>
        <Card className="space-y-3 p-4">
          {TIPS.map((tip) => (
            <p key={tip} className="flex gap-3 text-sm leading-relaxed text-muted">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>{t(`welcome.${tip}`)}</span>
            </p>
          ))}
        </Card>
      </section>

      <Button className="w-full" onClick={() => navigate("/training")}>
        {t("welcome.go")} <ArrowRight size={18} aria-hidden />
      </Button>
    </Page>
  );
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-black">
          <span className="text-accent">{icon}</span> {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
      </Card>
    </section>
  );
}
