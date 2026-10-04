/**
 * 10 kurze Tagessprüche (2–5 Wörter). Ein Spruch gilt den ganzen Kalendertag,
 * auf der Startseite läuft er Wort für Wort in einer Endlosschleife.
 */
export const DAILY_QUOTES: readonly (readonly string[])[] = [
  ["FEEL", "GOOD", "TODAY"],
  ["MOVE", "AND", "BREATHE"],
  ["STRONGER", "EVERY", "DAY"],
  ["JUST", "START", "TODAY"],
  ["TRAIN", "FEEL", "BETTER"],
  ["MOVE", "CLEAR", "YOUR", "MIND"],
  ["SMALL", "STEPS", "BIG", "PROGRESS"],
  ["SHOW", "UP", "TODAY"],
  ["PUSH", "BREATHE", "REPEAT"],
  ["MAKE", "TODAY", "COUNT"],
];

/**
 * Feste, gemischte Reihenfolge über 10 Tage. Weil es eine Permutation ist,
 * unterscheiden sich zwei aufeinanderfolgende Tage garantiert, und jeder Spruch
 * kommt alle 10 Tage einmal dran. Kein Zufall → kein Wechsel beim Reload.
 */
const DAY_ORDER = [3, 7, 0, 5, 9, 1, 6, 2, 8, 4];

/** Tage seit 1970-01-01, bezogen auf das lokale Kalenderdatum (nicht UTC). */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function dailyQuoteIndex(date: Date = new Date()): number {
  const day = localDayNumber(date);
  return DAY_ORDER[((day % DAY_ORDER.length) + DAY_ORDER.length) % DAY_ORDER.length];
}

export function getDailyQuote(date: Date = new Date()): readonly string[] {
  return DAILY_QUOTES[dailyQuoteIndex(date)];
}
