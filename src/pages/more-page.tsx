import { format } from "date-fns";
import { Download, HardDrive, Upload, Volume2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { useApp } from "@/app/app-context";
import { AppHeader, PageTitle } from "@/components/layout/app-header";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { backupService, profileRepository, settingsRepository } from "@/data";
import { parseBackup, type BackupFile, type BackupParseError } from "@/data/backup";
import type { Language } from "@/domain/types";
import { asset } from "@/lib/asset";
import { dateLocale } from "@/lib/dates";
import { countdownBeep, finishSignal, isVibrationSupported, unlockAudio } from "@/services/feedback";

function slug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

async function deliverFile(file: File) {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (coarse && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      // sonst: Download als Fallback
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function MorePage() {
  const { t, profile, settings, language } = useApp();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? profile.displayName ?? "";
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState<{ error: BackupParseError | { kind: "read" } } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    setNameDraft(null);
    if ((profile.displayName ?? "") === name.trim()) return;
    await profileRepository.update({ displayName: name });
    toast(t("common.saved"));
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const backup = await backupService.exportCurrentProfile();
      const namePart = backup.profile.displayName ? `-${slug(backup.profile.displayName)}` : "";
      const fileName = `7moveup${namePart}-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
      const file = new File([JSON.stringify(backup, null, 2)], fileName, { type: "application/json" });
      await deliverFile(file);
      toast(t("more.exported"));
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const result = parseBackup(await file.text());
      if (result.ok) setPendingImport(result.backup);
      else setImportError({ error: result.error });
    } catch {
      setImportError({ error: { kind: "read" } });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      await backupService.importReplacingCurrentProfile(pendingImport);
      setPendingImport(null);
      toast(t("more.imported"));
    } finally {
      setBusy(false);
    }
  };

  const errorText = (() => {
    if (!importError) return null;
    const { error } = importError;
    switch (error.kind) {
      case "invalid_json":
        return t("more.importError.invalid_json");
      case "wrong_app":
        return t("more.importError.wrong_app");
      case "newer_version":
        return t("more.importError.newer_version", { version: error.version });
      case "read":
        return t("more.importError.read");
      case "invalid_data":
        return t("more.importError.invalid_data");
    }
  })();

  const vibrationSupported = isVibrationSupported();

  return (
    <Page>
      <AppHeader left={<PageTitle>{t("more.title")}</PageTitle>} />

      <div className="space-y-8">
        <Section title={t("more.profile")} id="profile">
          <Card className="p-4">
            <Label htmlFor="display-name">{t("more.displayName")}</Label>
            <Input
              id="display-name"
              value={name}
              maxLength={40}
              autoComplete="nickname"
              placeholder={t("more.displayNamePlaceholder")}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <FieldHint>{t("more.displayNameHint")}</FieldHint>
          </Card>
        </Section>

        <Section title={t("more.settings")} id="settings">
          <Card className="divide-y divide-line">
            <div className="p-4">
              <p id="language-label" className="mb-3 text-sm font-bold">
                {t("more.language")}
              </p>
              <Segmented<Language>
                role="radio"
                ariaLabel={t("more.language")}
                layoutId="language-switch"
                value={language}
                onChange={(next) => void profileRepository.update({ language: next })}
                options={[
                  { value: "de", label: "Deutsch" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
            <SettingRow
              id="sound"
              title={t("more.sound")}
              hint={t("more.soundHint")}
              control={
                <Switch
                  id="sound"
                  checked={settings.soundEnabled}
                  onCheckedChange={(soundEnabled) => void settingsRepository.update({ soundEnabled })}
                  aria-describedby="sound-hint"
                />
              }
            >
              {settings.soundEnabled && (
                <button
                  type="button"
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl px-2 -ml-2 text-xs font-bold text-accent-light hover:bg-white/5"
                  onClick={() => {
                    unlockAudio();
                    countdownBeep();
                    window.setTimeout(countdownBeep, 1000);
                    window.setTimeout(countdownBeep, 2000);
                    window.setTimeout(finishSignal, 3000);
                  }}
                >
                  <Volume2 size={14} aria-hidden /> {t("more.testSound")}
                </button>
              )}
            </SettingRow>
            <SettingRow
              id="haptics"
              title={t("more.haptics")}
              hint={vibrationSupported ? t("more.hapticsHint") : `${t("more.hapticsHint")} – ${t("more.hapticsUnsupported")}`}
              control={
                <Switch
                  id="haptics"
                  checked={settings.hapticsEnabled}
                  onCheckedChange={(hapticsEnabled) => void settingsRepository.update({ hapticsEnabled })}
                  aria-describedby="haptics-hint"
                />
              }
            />
          </Card>
        </Section>

        <Section title={t("more.data")} id="data">
          <p className="-mt-1 mb-3 text-sm leading-relaxed text-muted">{t("more.dataHint")}</p>
          <div className="space-y-2">
            <Card className="p-4">
              <Button className="w-full" onClick={() => void exportData()} disabled={busy}>
                <Download size={18} aria-hidden /> {t("more.export")}
              </Button>
              <FieldHint>{t("more.exportHint")}</FieldHint>
            </Card>
            <Card className="p-4">
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                id="import-file"
                onChange={(e) => void onFileChosen(e.target.files?.[0])}
              />
              <Button variant="secondary" className="w-full" onClick={() => fileInput.current?.click()} disabled={busy}>
                <Upload size={18} aria-hidden /> {t("more.import")}
              </Button>
              <FieldHint>{t("more.importHint")}</FieldHint>
              {errorText && (
                <div role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  <p className="font-semibold">{errorText}</p>
                  {importError?.error.kind === "invalid_data" && (
                    <ul className="mt-1 list-inside list-disc text-xs opacity-90">
                      {importError.error.issues.map((issue) => (
                        <li key={issue} className="break-all">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </div>
        </Section>

        <Section title={t("more.about")} id="about">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <img src={asset("icons/app-icon-192.png")} alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
              <div>
                <p className="text-lg font-black tracking-tight">7MOVEUP</p>
                <p className="text-xs text-subtle">{t("more.version", { version: __APP_VERSION__ })}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{t("more.aboutText")}</p>
            <p className="mt-3 flex items-center gap-2 text-xs text-subtle">
              <HardDrive size={14} aria-hidden /> {t("more.storage")}
            </p>
          </Card>
        </Section>
      </div>

      <ConfirmSheet
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        title={t("more.importConfirmTitle")}
        description={t("more.importConfirmText")}
        confirmLabel={t("more.importReplace")}
        destructive
        onConfirm={() => void confirmImport()}
      >
        {pendingImport && (
          <Card className="p-4 text-sm">
            <p className="font-bold">{pendingImport.profile.displayName || t("profile.fallback")}</p>
            <p className="mt-1 text-muted">
              {t("more.importSummary", {
                plans: pendingImport.plans.length,
                sessions: pendingImport.sessions.length,
                exercises: pendingImport.customExercises.length,
                notes: pendingImport.exerciseNotes.length,
              })}
            </p>
            <p className="mt-1 text-xs text-subtle">
              {t("more.importExportedAt", { date: formatExportDate(pendingImport.exportedAt, language) })}
            </p>
          </Card>
        )}
      </ConfirmSheet>
    </Page>
  );
}

function formatExportDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, language === "de" ? "d. MMMM yyyy, HH:mm" : "MMMM d, yyyy, h:mm a", { locale: dateLocale(language) });
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`}>
      <SectionTitle id={`${id}-title`}>{title}</SectionTitle>
      {children}
    </section>
  );
}

function SettingRow({
  id,
  title,
  hint,
  control,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  control: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-bold">
            {title}
          </label>
          <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-subtle">
            {hint}
          </p>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}
