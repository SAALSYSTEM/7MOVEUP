/**
 * "14, 16, 18" · "14;16;18" · "14 16 18" → [14, 16, 18].
 * "2,5" bzw. "12,25" wird als Dezimalzahl gelesen (typische Hantelscheiben-Schritte).
 */
export function parseSteps(text: string): number[] | undefined {
  const values = text
    .split(/[;\s/|]+/)
    .flatMap((part) => (/^\d+,(5|25|75)$/.test(part) ? [part.replace(",", ".")] : part.split(",")))
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return values.length ? Array.from(new Set(values)).sort((a, b) => a - b) : undefined;
}
