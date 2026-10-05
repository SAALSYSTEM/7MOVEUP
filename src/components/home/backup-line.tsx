import { HardDrive } from "lucide-react";

import { useApp } from "@/app/app-context";
import { Button } from "@/components/ui/button";
import type { BackupReminder } from "@/domain/backup-reminder";
import { backupAgeText } from "@/lib/backup-text";

/** Ganz unten auf Heute: unaufdringliche Zeile, ab 7 Tagen (mit neuen Daten) leicht hervorgehoben. */
export function BackupLine({ reminder, onBackup, busy }: { reminder: BackupReminder; onBackup: () => void; busy: boolean }) {
  const { t } = useApp();
  if (!reminder.show) return null;
  const age = backupAgeText(t, reminder);

  if (reminder.recommended) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 py-2 pl-4 pr-2">
        <HardDrive size={16} className="shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-xs font-semibold leading-snug">
          <span className="text-accent-light">{t("backup.recommended")}</span> · {age}
        </p>
        <Button size="sm" onClick={onBackup} disabled={busy} className="h-9 shrink-0 px-3 text-xs">
          {t("backup.create")}
        </Button>
      </div>
    );
  }

  return (
    <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-subtle">
      <HardDrive size={13} aria-hidden /> {age}
    </p>
  );
}
