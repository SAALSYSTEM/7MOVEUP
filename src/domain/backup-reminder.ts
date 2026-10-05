/**
 * Backup-Hinweis – bewusst einfach:
 * - Zeile „Letztes Backup: vor X Tagen“ immer (sobald es eigene Daten oder ein Backup gibt)
 * - hervorgehoben („Backup empfohlen“), wenn ≥ 7 Tage seit dem letzten Backup UND seitdem neue Daten
 * - ohne bisheriges Backup: empfohlen ab 7 Tagen nach den ersten eigenen Daten
 * Kein Popup, kein täglicher Reminder.
 */
import { differenceInCalendarDays } from "date-fns";

export const BACKUP_INTERVAL_DAYS = 7;

export type BackupReminder = {
  /** Zeile auf Heute anzeigen */
  show: boolean;
  /** hervorgehoben + Button */
  recommended: boolean;
  /** Kalendertage seit dem letzten Backup; fehlt = noch nie */
  daysSince?: number;
};

export function backupReminder({
  lastBackupAt,
  firstDataAt,
  lastDataAt,
  now = new Date(),
}: {
  lastBackupAt?: string;
  /** frühester Zeitpunkt eigener Daten (Training, Messung, Plan, eigene Übung, Notiz) */
  firstDataAt?: string;
  /** letzte Änderung eigener Daten */
  lastDataAt?: string;
  now?: Date;
}): BackupReminder {
  const hasData = Boolean(firstDataAt);
  const daysSince = lastBackupAt ? Math.max(0, differenceInCalendarDays(now, new Date(lastBackupAt))) : undefined;
  let recommended = false;
  if (hasData) {
    if (lastBackupAt && daysSince !== undefined) {
      recommended = daysSince >= BACKUP_INTERVAL_DAYS && Boolean(lastDataAt && lastDataAt > lastBackupAt);
    } else if (firstDataAt) {
      recommended = differenceInCalendarDays(now, new Date(firstDataAt)) >= BACKUP_INTERVAL_DAYS;
    }
  }
  return { show: hasData || Boolean(lastBackupAt), recommended, daysSince };
}
