import type { Language } from "@/domain/types";

type Phrase = Record<Language, string[]>;

/** 10 Sprüche (Texte aus der Starter-Referenz), DE/EN semantisch gleich. */
export const DAILY_MOTIVATIONS: Phrase[] = [
  { de: ["FÜHL DICH GUT.", "TRAINIER HEUTE."], en: ["FEEL GOOD.", "TRAIN TODAY."] },
  { de: ["JEDEN TAG", "STÄRKER."], en: ["STRONGER", "EVERY DAY."] },
  { de: ["KEINE AUSREDEN.", "EINFACH STARTEN."], en: ["NO EXCUSES.", "JUST START."] },
  { de: ["BEWEG DICH.", "KOPF FREI."], en: ["MOVE YOUR BODY.", "CLEAR YOUR MIND."] },
  { de: ["TRAINIER HART.", "FÜHL DICH STARK."], en: ["TRAIN HARD.", "FEEL GREAT."] },
  { de: ["SEI HEUTE", "FÜR DICH DA."], en: ["SHOW UP", "FOR YOURSELF."] },
  { de: ["EIN WORKOUT KANN", "DEINEN TAG VERÄNDERN."], en: ["ONE WORKOUT CAN", "CHANGE YOUR DAY."] },
  { de: ["SCHWITZEN.", "LÄCHELN. WIEDERHOLEN."], en: ["SWEAT.", "SMILE. REPEAT."] },
  { de: ["KLEINE SCHRITTE.", "GROSSER FORTSCHRITT."], en: ["SMALL STEPS.", "BIG PROGRESS."] },
  { de: ["HEUTE IST EIN GUTER TAG,", "STÄRKER ZU WERDEN."], en: ["TODAY IS A GOOD DAY", "TO GET STRONGER."] },
];

/**
 * Feste, gemischte Reihenfolge über 10 Tage. Weil es eine Permutation ist,
 * unterscheiden sich zwei aufeinanderfolgende Tage garantiert, und jeder Spruch
 * kommt alle 10 Tage einmal dran.
 */
const DAY_ORDER = [3, 7, 0, 5, 9, 1, 6, 2, 8, 4];

/** Tage seit 1970-01-01, bezogen auf das lokale Kalenderdatum (nicht UTC). */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function dailyMotivationIndex(date: Date = new Date()): number {
  const day = localDayNumber(date);
  return DAY_ORDER[((day % DAY_ORDER.length) + DAY_ORDER.length) % DAY_ORDER.length];
}

export function getDailyMotivation(language: Language, date: Date = new Date()): string[] {
  return DAILY_MOTIVATIONS[dailyMotivationIndex(date)][language];
}
