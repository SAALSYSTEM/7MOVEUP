/** Pfad zu Dateien aus /public – berücksichtigt den Basis-Pfad (z. B. /7MOVEUP/ auf GitHub Pages). */
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

/** Router-Basename ohne abschließenden Slash ("/" bleibt "/"). */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
