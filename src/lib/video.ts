/** Erkennt YouTube-/Shorts-Links und liefert die Video-ID für ein datensparsames Embed. */
export function youtubeId(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return undefined;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  const valid = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? id : undefined);

  if (host === "youtu.be") return valid(parsed.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const [, first, second] = parsed.pathname.split("/");
    if (first === "watch") return valid(parsed.searchParams.get("v"));
    if (first === "shorts" || first === "embed" || first === "live" || first === "v") return valid(second);
  }
  return undefined;
}

export function isShortsUrl(url: string): boolean {
  return /\/shorts\//.test(url);
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
