/**
 * Orchestrierung:  node src/render.mjs [--lang de|en|all] [--format 9x16|16x9|all] [--no-music] [--stills] [--skip-build] [--skip-capture]
 *
 * 1. App bauen (npm run build im Repo-Root, Basis "/")
 * 2. Pass 1: echte App aufnehmen  → work/<lang>/app/*.jpg + events.json
 * 3. Pass 2: Komposition rendern  → work/<lang>/<format>/video.mp4 (ohne Ton)
 * 4. Ton synthetisieren           → work/<lang>/audio.wav
 * 5. Poster wählen + als Frame 0 einbrennen, Ton muxen → output/*.mp4 + *.jpg
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { renderAudio } from "./audio.mjs";
import { captureApp } from "./capture-app.mjs";
import { DURATION, FORMATS, FPS, POSTER_AT } from "./config.mjs";
import { REPO_ROOT, startServer, VIDEO_ROOT } from "./server.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const langs = arg("lang", "all") === "all" ? ["de", "en"] : [arg("lang")];
const formats = arg("format", "all") === "all" ? Object.keys(FORMATS) : [arg("format")];
const withMusic = !flag("no-music");
const stillsOnly = flag("stills");

const OUT = path.join(VIDEO_ROOT, "output");
const WORK = path.join(VIDEO_ROOT, "work");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const log = (...m) => console.log(...m);

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { stdio: "inherit", ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} fehlgeschlagen`);
}

function outputName(lang, format, ext) {
  const suffix = lang === "de" ? "" : `-${lang}`;
  return path.join(OUT, `7moveup-app-video-${format}${suffix}.${ext}`);
}

async function renderComposition({ origin, lang, format, file, frames }) {
  const { width, height } = FORMATS[format];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${origin}/__video/composition.html?lang=${lang}&format=${format}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30_000 });

  if (frames) {
    for (const f of frames) {
      await page.evaluate((n) => window.renderFrame(n), f);
      await page.screenshot({ path: `${file}-${String(f).padStart(4, "0")}.png` });
    }
    await browser.close();
    return;
  }

  const total = Math.round(DURATION * FPS);
  const ffmpeg = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(FPS), file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolve, reject) => ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));
  for (let f = 0; f < total; f += 1) {
    await page.evaluate((n) => window.renderFrame(n), f);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (f % 90 === 0) process.stdout.write(`\r    Frame ${f}/${total}`);
  }
  process.stdout.write(`\r    Frame ${total}/${total}\n`);
  ffmpeg.stdin.end();
  await done;
  await browser.close();
  if (errors.length) throw new Error(`Kompositionsfehler: ${errors.join(" | ")}`);
}

function finalize({ silentVideo, audio, poster, out }) {
  // Poster aus dem fertigen Bild ziehen (ruhiger Moment, Text steht)
  run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(POSTER_AT), "-i", silentVideo, "-frames:v", "1", "-q:v", "2", poster]);
  // Poster als Frame 0 einbrennen (Thumbnail auf allen Plattformen) + Ton dazu
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", silentVideo, "-i", poster, "-i", audio,
    "-filter_complex", "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v];[2:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]",
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart",
    out,
  ]);
}

async function main() {
  if (!flag("skip-build")) {
    log("▶ App bauen …");
    run("npm", ["run", "build"], { cwd: REPO_ROOT, env: { ...process.env, BASE_PATH: "/" } });
  }
  const { server, origin } = await startServer();
  try {
    for (const lang of langs) {
      const workDir = path.join(WORK, lang);
      fs.mkdirSync(workDir, { recursive: true });
      let events;
      if (flag("skip-capture") && fs.existsSync(path.join(workDir, "events.json"))) {
        events = JSON.parse(fs.readFileSync(path.join(workDir, "events.json"), "utf8"));
      } else {
        log(`▶ [${lang}] Pass 1: echte App aufnehmen …`);
        events = await captureApp({ lang, origin, workDir, log });
        log(`  ${events.frames} App-Frames, ${events.taps.length} Taps, ${events.tones.length} Timer-Töne`);
      }

      if (stillsOnly) {
        const stillFrames = (arg("frames", "") || "0,60,120,147,175,200,240,275,300,330,370,420,440,470,500,520,560,590,615,660,700,720,770,800,830,860,895")
          .split(",")
          .map(Number);
        for (const format of formats) {
          const dir = path.join(workDir, "stills");
          fs.mkdirSync(dir, { recursive: true });
          log(`▶ [${lang}] Stills ${format} …`);
          await renderComposition({ origin, lang, format, file: path.join(dir, format), frames: stillFrames });
        }
        continue;
      }

      const audio = path.join(workDir, withMusic ? "audio.wav" : "audio-sfx.wav");
      log(`▶ [${lang}] Ton synthetisieren${withMusic ? "" : " (ohne Musik)"} …`);
      renderAudio(audio, events, { music: withMusic });

      for (const format of formats) {
        log(`▶ [${lang}] Pass 2: Komposition ${format} …`);
        const silentVideo = path.join(workDir, `${format}.mp4`);
        if (flag("reuse-video") && fs.existsSync(silentVideo)) log("  (Bildspur wiederverwendet)");
        else await renderComposition({ origin, lang, format, file: silentVideo });
        const out = outputName(lang, format, "mp4");
        finalize({ silentVideo, audio, poster: outputName(lang, format, "jpg"), out });
        log(`  ✓ ${path.relative(REPO_ROOT, out)}`);
      }
    }
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
