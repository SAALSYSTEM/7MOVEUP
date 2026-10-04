import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { DAILY_MOTIVATIONS, dailyMotivationIndex, getDailyMotivation } from "./motivation";

describe("Tagesmotivation", () => {
  it("hat 10 Sprüche, DE und EN mit gleicher Zeilenzahl", () => {
    expect(DAILY_MOTIVATIONS).toHaveLength(10);
    for (const phrase of DAILY_MOTIVATIONS) expect(phrase.de.length).toBe(phrase.en.length);
  });

  it("ist am selben Kalendertag stabil – egal zu welcher Uhrzeit", () => {
    const morning = new Date(2026, 9, 4, 0, 5);
    const night = new Date(2026, 9, 4, 23, 55);
    expect(getDailyMotivation("de", morning)).toEqual(getDailyMotivation("de", night));
  });

  it("wechselt an jedem Folgetag und nutzt alle 10 Sprüche", () => {
    const start = new Date(2026, 0, 1, 12);
    const seen = new Set<number>();
    for (let i = 0; i < 800; i += 1) {
      const today = dailyMotivationIndex(addDays(start, i));
      const tomorrow = dailyMotivationIndex(addDays(start, i + 1));
      expect(today).not.toBe(tomorrow);
      seen.add(today);
    }
    expect(seen.size).toBe(10);
  });

  it("DE und EN wählen denselben Spruch", () => {
    const date = new Date(2026, 9, 4);
    const index = dailyMotivationIndex(date);
    expect(getDailyMotivation("en", date)).toEqual(DAILY_MOTIVATIONS[index].en);
    expect(getDailyMotivation("de", date)).toEqual(DAILY_MOTIVATIONS[index].de);
  });
});
