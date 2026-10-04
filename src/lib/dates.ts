import { addDays, format, getISODay, parseISO, startOfWeek } from "date-fns";
import { de as deLocale, enUS } from "date-fns/locale";

import type { Language, Weekday } from "@/domain/types";

export function localDateKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function isoWeekday(date: Date): Weekday {
  return getISODay(date) as Weekday;
}

export function weekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function weekDays(date: Date = new Date()): Date[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dateLocale(language: Language) {
  return language === "de" ? deLocale : enUS;
}

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
