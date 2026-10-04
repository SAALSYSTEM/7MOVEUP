import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { DAILY_QUOTES, dailyQuoteIndex, getDailyQuote } from "./motivation";

describe("Tagesspruch", () => {
  it("hat 10 Sprüche mit je 2–5 Wörtern in Großbuchstaben", () => {
    expect(DAILY_QUOTES).toHaveLength(10);
    for (const quote of DAILY_QUOTES) {
      expect(quote.length).toBeGreaterThanOrEqual(2);
      expect(quote.length).toBeLessThanOrEqual(5);
      for (const word of quote) expect(word).toBe(word.toUpperCase());
    }
  });

  it("ist am selben Kalendertag stabil – egal zu welcher Uhrzeit", () => {
    const morning = new Date(2026, 9, 4, 0, 5);
    const night = new Date(2026, 9, 4, 23, 55);
    expect(getDailyQuote(morning)).toEqual(getDailyQuote(night));
  });

  it("wechselt an jedem Folgetag und nutzt alle 10 Sprüche", () => {
    const start = new Date(2026, 0, 1, 12);
    const seen = new Set<number>();
    for (let i = 0; i < 800; i += 1) {
      const today = dailyQuoteIndex(addDays(start, i));
      expect(today).not.toBe(dailyQuoteIndex(addDays(start, i + 1)));
      seen.add(today);
    }
    expect(seen.size).toBe(10);
  });
});
