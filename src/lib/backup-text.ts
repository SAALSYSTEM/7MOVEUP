import type { BackupReminder } from "@/domain/backup-reminder";
import type { Translate } from "@/i18n";

/** „Letztes Backup: heute / gestern / vor X Tagen“ bzw. „Noch kein Backup erstellt“ */
export function backupAgeText(t: Translate, reminder: Pick<BackupReminder, "daysSince">) {
  const { daysSince } = reminder;
  if (daysSince === undefined) return t("backup.never");
  if (daysSince === 0) return t("backup.today");
  if (daysSince === 1) return t("backup.yesterday");
  return t("backup.daysAgo", { count: daysSince });
}
