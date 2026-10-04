import { describe, expect, it } from "vitest";

import { isSafeHttpUrl, youtubeId } from "./video";

describe("YouTube-Links", () => {
  it.each([
    ["https://youtube.com/shorts/_G5xkrVfZ88?si=XN6cYyANf6uRiDe3", "_G5xkrVfZ88"],
    ["https://youtu.be/YlYAJy0wja0?si=1yaMGTXsgkJIjCdh", "YlYAJy0wja0"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/-8xqJ2xXs2A", "-8xqJ2xXs2A"],
  ])("%s", (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });

  it("andere Links → kein Embed, aber gültiger Link", () => {
    expect(youtubeId("https://vimeo.com/123")).toBeUndefined();
    expect(isSafeHttpUrl("https://vimeo.com/123")).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
