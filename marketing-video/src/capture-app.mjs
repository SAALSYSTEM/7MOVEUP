/**
 * Pass 1: nimmt die ECHTE 7MOVEUP-App Frame für Frame auf.
 *
 * - Headless Chromium mit virtueller Uhr (Playwright clock): Timer, Wortschleife und
 *   Framer-Motion-Animationen laufen exakt nach Videozeit, unabhängig von der Rechenleistung.
 * - Demo-Daten kommen über die echte Import-Funktion der App.
 * - Protokolliert Taps, Hervorhebungen, Tipp-Ereignisse und die Timer-Pieptöne für Overlay und Ton.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { DEMO_NOW, FPS, SCENES } from "./config.mjs";
import { buildDemoBackup, DEMO_NOTE } from "./demo-data.mjs";

const LABELS = {
  de: {
    importReplace: "Ersetzen & importieren",
    start: "Training starten",
    lastTime: "Letztes Mal",
    chip22: "22 kg",
    markDone: "Satz 1 abhaken · Kurzhantel-Flachbankdrücken",
    openTimer: "Timer für Satz 1 öffnen · Plank",
    timerStart: "Start",
    discard: "Training verwerfen",
    del: "Löschen",
    calendar: "Kalender",
    regionGroup: "Körperregion",
    region: "Brust",
    equipmentGroup: "Equipment",
    equipment: "Kurzhanteln",
    row: /^Kurzhantel-Flachbankdrücken/,
    note: "Meine Notiz",
    exportBtn: "Daten sichern",
  },
  en: {
    importReplace: "Replace & import",
    start: "Start workout",
    lastTime: "Last time",
    chip22: "22 kg",
    markDone: "Check off set 1 · Dumbbell Flat Bench Press",
    openTimer: "Open timer for set 1 · Plank",
    timerStart: "Start",
    discard: "Discard workout",
    del: "Delete",
    calendar: "Calendar",
    regionGroup: "Body region",
    region: "Chest",
    equipmentGroup: "Equipment",
    equipment: "Dumbbells",
    row: /^Dumbbell Flat Bench Press/,
    note: "My note",
    exportBtn: "Back up data",
  },
};

/** läuft in jeder Seite VOR dem App-Code */
function initScript() {
  // Framer Motion nutzt sonst die Web Animations API (läuft in Echtzeit). Ohne sie animiert es per
  // requestAnimationFrame – und das steuert die virtuelle Uhr. Die Animationen selbst bleiben identisch.
  delete Element.prototype.animate;
  // Export soll wie am Desktop als Download laufen (kein Teilen-Dialog im Headless-Browser)
  Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
  Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
  // Timer-Töne mitschreiben (Frame + Frequenz), damit die Tonspur exakt passt
  window.__frame = 0;
  window.__tones = [];
  const Original = window.AudioContext;
  if (Original) {
    window.AudioContext = class extends Original {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (...args) => {
          window.__tones.push({ frame: window.__frame, f: osc.frequency.value });
          return start(...args);
        };
        return osc;
      }
    };
  }
  // CSS-Übergänge (150 ms Farbwechsel) laufen in Echtzeit → für reproduzierbare Frames aus
  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = "*,*::before,*::after{transition:none!important;animation:none!important}";
    document.head.appendChild(style);
  });
}

export async function captureApp({ lang, origin, workDir, log = console.log }) {
  const L = LABELS[lang];
  const framesDir = path.join(workDir, "app");
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: lang === "de" ? "de-DE" : "en-US",
    timezoneId: "Europe/Berlin",
    colorScheme: "dark",
    reducedMotion: "no-preference",
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  await context.addInitScript(initScript);
  // Uhr installieren und ANHALTEN: Zeit vergeht nur noch, wenn das Skript sie vorspult
  await context.clock.install({ time: new Date(new Date(DEMO_NOW).getTime() - 5000) });
  await context.clock.pauseAt(new Date(DEMO_NOW));
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  // ---------------------------------------------------------------- Helfer
  let frame = 0;
  const events = { fps: FPS, taps: [], highlights: [], typing: [], pops: [], tones: [] };

  const realWait = (ms) => page.waitForTimeout(ms);
  /** virtuelle Zeit vorspulen und echter Zeit Raum für IndexedDB/React geben */
  async function fakeWait(ms) {
    for (let done = 0; done < ms; done += 50) {
      await page.clock.runFor(50);
      await realWait(4);
    }
  }
  async function navigate(pathname, { settle = true } = {}) {
    await page.evaluate((p) => {
      history.pushState({}, "", p);
      dispatchEvent(new PopStateEvent("popstate"));
    }, pathname);
    await realWait(350);
    if (settle) {
      await fakeWait(600);
      await realWait(150);
    }
  }
  async function centerOf(locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Element nicht sichtbar: ${locator}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  }
  /** sichtbarer Tap: Overlay bekommt Position + Frame, dann echter Klick */
  async function tap(locator, { wait = 160 } = {}) {
    const { x, y } = await centerOf(locator);
    events.taps.push({ frame, x, y });
    await page.mouse.click(x, y);
    await realWait(wait);
  }
  async function highlight(locator, seconds) {
    const box = await locator.boundingBox();
    if (box) events.highlights.push({ from: frame, to: frame + Math.round(seconds * FPS), box });
  }
  async function shot() {
    const file = path.join(framesDir, `${String(frame).padStart(4, "0")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 90, caret: "initial" });
  }
  /** nimmt Frames auf, bis die Videozeit endT erreicht ist */
  async function recordUntil(endT, { actions = [], speed = () => 1 } = {}) {
    const queue = [...actions].sort((a, b) => a.at - b.at);
    while (frame / FPS < endT - 1e-6) {
      const t = frame / FPS;
      while (queue.length && queue[0].at <= t + 1e-6) await queue.shift().run();
      await shot();
      frame += 1;
      await page.evaluate((f) => {
        window.__frame = f;
      }, frame);
      const s = speed(t);
      if (s > 0) await page.clock.runFor((1000 / FPS) * s);
    }
    if (queue.length) throw new Error(`Aktionen nicht ausgeführt: ${queue.map((q) => q.at).join(", ")}`);
  }
  const sceneEnd = (id) => SCENES.find((s) => s.id === id).end;

  // ---------------------------------------------------------------- Vorbereitung: Demo-Daten importieren
  log("  Demo-Daten importieren …");
  await page.goto(`${origin}/more`);
  await page.locator("#import-file").waitFor({ state: "attached" });
  await realWait(300);
  await page.locator("#import-file").setInputFiles({
    name: "7moveup-demo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(buildDemoBackup(lang))),
  });
  await realWait(300);
  await fakeWait(500);
  await page.getByRole("dialog").getByRole("button", { name: L.importReplace }).click();
  await realWait(500);
  await fakeWait(3200);

  // ---------------------------------------------------------------- 1 Hook + 2 Training
  log("  Szene: Startseite → Training …");
  await navigate("/", { settle: false }); // Wortschleife startet exakt mit dem ersten Frame
  await recordUntil(sceneEnd("session"), {
    // 1,5-fach bis PROGRESS steht, dann angehalten (Standbild) bis zum Tap, danach Echtzeit
    speed: (t) => (t < 4.75 ? 1.5 : t < 6.1 ? 0 : 1),
    actions: [
      { at: 6.1, run: () => tap(page.getByRole("button", { name: L.start }), { wait: 700 }) },
      {
        at: 6.9,
        run: () => highlight(page.getByText(L.lastTime).first().locator(".."), 1.8),
      },
      { at: 8.0, run: () => tap(page.getByRole("button", { name: L.chip22, exact: true })) },
      { at: 9.3, run: () => tap(page.getByRole("button", { name: L.markDone })) },
    ],
  });

  // ---------------------------------------------------------------- 3 Timer
  log("  Szene: Timer …");
  const timerButton = page.getByRole("button", { name: L.openTimer });
  await timerButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 140));
  await realWait(100);
  await timerButton.click();
  await realWait(200);
  await fakeWait(700);
  await page.getByRole("dialog").getByRole("button", { name: L.timerStart, exact: true }).click();
  await realWait(100);
  await page.clock.runFor(36_400); // 40-s-Plank: die letzten 3,6 Sekunden zeigen
  await realWait(150);
  await recordUntil(sceneEnd("timer"));

  // ---------------------------------------------------------------- 4 Trainingspläne
  log("  Szene: Trainingspläne …");
  await page.keyboard.press("Escape");
  await fakeWait(600);
  await page.getByRole("button", { name: L.discard }).click();
  await fakeWait(600);
  await page.getByRole("dialog").getByRole("button", { name: L.del, exact: true }).click();
  await realWait(500);
  await fakeWait(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await realWait(100);
  await recordUntil(sceneEnd("plans"), {
    actions: [{ at: 16.6, run: () => tap(page.getByRole("tab", { name: L.calendar })) }],
  });

  // ---------------------------------------------------------------- 5 Übungen + 6 Notiz/Video
  log("  Szene: Übungen → Notiz …");
  // Notiz leeren, damit sie im Video live getippt werden kann
  await navigate("/exercises/db-flat-bench-press");
  const noteBox = page.getByRole("textbox", { name: L.note });
  await noteBox.fill("");
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await realWait(300);
  await fakeWait(3200);
  await navigate("/exercises");
  await page.evaluate(() => window.scrollTo(0, 0));
  await realWait(100);

  const note = DEMO_NOTE[lang];
  const typeStart = 21.55;
  const typing = [...note].map((ch, i) => ({
    at: typeStart + i / FPS,
    run: async () => {
      events.typing.push({ frame });
      await page.keyboard.type(ch);
    },
  }));
  const scrollFrom = 23.35;
  const scrollFrames = 18;
  const scrolling = Array.from({ length: scrollFrames }, (_, i) => ({
    at: scrollFrom + i / FPS,
    run: () =>
      page.evaluate((p) => {
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        window.scrollTo(0, Math.round(e * 190));
      }, (i + 1) / scrollFrames),
  }));
  await recordUntil(sceneEnd("notes"), {
    actions: [
      { at: 18.9, run: () => tap(page.getByRole("group", { name: L.regionGroup }).getByRole("button", { name: L.region, exact: true })) },
      { at: 19.6, run: () => tap(page.getByRole("group", { name: L.equipmentGroup }).getByRole("button", { name: L.equipment, exact: true })) },
      { at: 20.5, run: () => tap(page.getByRole("button", { name: L.row }), { wait: 600 }) },
      { at: 21.35, run: () => tap(page.getByRole("textbox", { name: L.note })) },
      ...typing,
      {
        at: 23.0,
        run: async () => {
          await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
          events.pops.push({ frame });
          await realWait(250);
        },
      },
      ...scrolling,
    ],
  });

  // ---------------------------------------------------------------- 7 Daten / kein Account
  log("  Szene: Daten …");
  await navigate("/more");
  await fakeWait(3000);
  await page.evaluate(() => {
    const title = document.getElementById("data-title");
    if (title) window.scrollTo(0, title.getBoundingClientRect().top + window.scrollY - 64);
  });
  await realWait(150);
  await recordUntil(sceneEnd("data"), {
    actions: [
      {
        at: 25.1,
        run: async () => {
          await tap(page.getByRole("button", { name: L.exportBtn }), { wait: 400 });
          events.pops.push({ frame: frame + 2 });
        },
      },
    ],
  });

  events.tones = await page.evaluate(() => window.__tones);
  events.frames = frame;
  events.pageErrors = pageErrors;
  fs.writeFileSync(path.join(workDir, "events.json"), JSON.stringify(events, null, 2));
  await browser.close();
  if (pageErrors.length) log(`  ⚠ Seitenfehler: ${pageErrors.join(" | ")}`);
  return events;
}
