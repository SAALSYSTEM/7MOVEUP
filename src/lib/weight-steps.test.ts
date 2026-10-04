import { describe, expect, it } from "vitest";

import { parseSteps } from "./weight-steps";

describe("Gewichtsstufen", () => {
  it.each([
    ["14, 16, 18", [14, 16, 18]],
    ["14;16;18", [14, 16, 18]],
    ["14 16 18", [14, 16, 18]],
    ["14,16,18", [14, 16, 18]],
    ["2,5; 5; 7,5", [2.5, 5, 7.5]],
    ["2.5, 5", [2.5, 5]],
    ["18, 14, 14", [14, 18]],
  ])("%s → %j", (input, expected) => {
    expect(parseSteps(input)).toEqual(expected);
  });

  it("leere Eingabe → undefined", () => {
    expect(parseSteps("  ")).toBeUndefined();
  });
});
