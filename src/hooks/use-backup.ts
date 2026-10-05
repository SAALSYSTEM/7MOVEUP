import { format } from "date-fns";
import { useState } from "react";

import { useApp } from "@/app/app-context";
import { useToast } from "@/components/ui/toast";
import { backupService } from "@/data";
import { backupReminder } from "@/domain/backup-reminder";
import { useData } from "@/hooks/use-data";
import { useToday } from "@/hooks/use-today";
import { deliverFile, slug } from "@/services/backup-file";

/** Backup erstellen (Teilen/Download) und Zeitpunkt merken – nur wenn nicht abgebrochen. */
export function useBackupExport() {
  const { t } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const backup = await backupService.exportCurrentProfile();
      const namePart = backup.profile.displayName ? `-${slug(backup.profile.displayName)}` : "";
      const fileName = `7moveup${namePart}-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
      const file = new File([JSON.stringify(backup, null, 2)], fileName, { type: "application/json" });
      const result = await deliverFile(file);
      if (result === "cancelled") return;
      await backupService.markBackupCreated(backup.exportedAt);
      toast(t("more.exported"));
    } finally {
      setBusy(false);
    }
  };

  return { exportBackup, busy };
}

/** Stand des letzten Backups + ob ein Backup empfohlen ist (≥ 7 Tage und neue Daten). */
export function useBackupStatus() {
  const today = useToday();
  const { data } = useData(() => backupService.getBackupInfo());
  return { info: data, reminder: data ? backupReminder({ ...data, now: today }) : undefined };
}
