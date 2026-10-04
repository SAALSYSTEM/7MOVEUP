/**
 * Kleiner statischer Server für die Aufnahme:
 *   /            → gebaute App (dist/) mit SPA-Fallback, wie später auf Cloudflare
 *   /__video/*   → Komposition (src/)
 *   /__work/*    → aufgenommene App-Frames (work/)
 *   /__brand/*   → Logo (brand/)
 *   /__fonts/*   → Inter (aus den App-Abhängigkeiten)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(VIDEO_ROOT, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

const MOUNTS = [
  ["/__video/", path.join(VIDEO_ROOT, "src")],
  ["/__work/", path.join(VIDEO_ROOT, "work")],
  ["/__brand/", path.join(REPO_ROOT, "brand")],
  ["/__fonts/", path.join(REPO_ROOT, "node_modules/@fontsource-variable/inter/files")],
];

function send(res, file, status = 200) {
  res.writeHead(status, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

export function startServer(port = 4317) {
  const dist = path.join(REPO_ROOT, "dist");
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    for (const [prefix, dir] of MOUNTS) {
      if (url.startsWith(prefix)) {
        const file = path.join(dir, url.slice(prefix.length));
        if (file.startsWith(dir) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, file);
        res.writeHead(404);
        return res.end("not found");
      }
    }
    const file = path.join(dist, url);
    if (file.startsWith(dist) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, file);
    return send(res, path.join(dist, "index.html")); // SPA-Fallback
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${port}` })));
}
