/**
 * Pass 2: Komposition. Jeder Frame ist eine reine Funktion der Videozeit t –
 * keine CSS-Animationen, nichts läuft „von selbst“. Der Treiber ruft renderFrame(f) auf
 * und macht danach einen Screenshot.
 */
import { CAPTIONS, CONTINUOUS_CUTS, DURATION, FINALE, FORMATS, FPS, HOOK_CLAIM_AT, SCENES } from "./config.mjs";

const params = new URLSearchParams(location.search);
const lang = params.get("lang") === "en" ? "en" : "de";
const formatId = params.get("format") === "16x9" ? "16x9" : "9x16";
const { width: W, height: H } = FORMATS[formatId];
const vertical = formatId === "9x16";

const APP_W = 390;
const APP_H = 844;

// ------------------------------------------------------------------ Layout je Format
const L = vertical
  ? {
      scale: 1.5,
      bezel: 13,
      phoneCenterX: W / 2,
      phoneTop: 572,
      hookZoom: 1.3,
      hookTop: 475,
      caption: { x: 80, y: 200, w: W - 160, h: 330, align: "center", size: 78 },
      brand: { x: W / 2, y: 112, align: "center" },
      logo: 300,
      wordmark: 128,
      tagline: 40,
      gap: 46,
    }
  : {
      scale: 1.04,
      bezel: 10,
      phoneCenterX: 1350,
      phoneTop: 91,
      hookZoom: 1.18,
      hookTop: 234,
      caption: { x: 170, y: 300, w: 880, h: 480, align: "left", size: 88 },
      brand: { x: 170, y: 120, align: "left" },
      logo: 230,
      wordmark: 120,
      tagline: 36,
      gap: 38,
    };

const screenW = APP_W * L.scale;
const screenH = APP_H * L.scale;
const phoneW = screenW + 2 * L.bezel;
const phoneH = screenH + 2 * L.bezel;

// ------------------------------------------------------------------ Easing & Helfer
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, p) => a + (b - a) * p;
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const easeOutBack = (p) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2;
};
const progress = (t, from, to) => clamp01((t - from) / (to - from));
const $ = (id) => document.getElementById(id);

function markup(text) {
  return text
    .split("\n")
    .map((line) => `<span class="line">${line.replace(/\*(.+?)\*/g, '<span class="accent">$1</span>')}</span>`)
    .join("");
}

// ------------------------------------------------------------------ Statisches Setup
const stage = $("stage");
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;

Object.assign($("glow1").style, {
  width: `${W * 0.9}px`,
  height: `${W * 0.9}px`,
  left: `${W * 0.45}px`,
  top: `${-W * 0.35}px`,
  background: "rgba(255,106,0,0.10)",
});
Object.assign($("glow2").style, {
  width: `${W * 0.8}px`,
  height: `${W * 0.8}px`,
  left: `${-W * 0.35}px`,
  top: `${H - W * 0.45}px`,
  background: "rgba(255,106,0,0.06)",
});

$("brand-icon").src = "/__brand/app-icon-1024.png";
const brand = $("brand");
brand.style.top = `${L.brand.y - 29}px`;
if (L.brand.align === "center") {
  brand.style.left = "50%";
  brand.style.translate = "-50% 0";
} else {
  brand.style.left = `${L.brand.x}px`;
}

const phone = $("phone");
Object.assign(phone.style, {
  width: `${phoneW}px`,
  height: `${phoneH}px`,
  left: `${L.phoneCenterX - phoneW / 2}px`,
  top: `${L.phoneTop}px`,
});
$("device").style.borderRadius = `${62 * L.scale}px`;
const screen = $("screen");
Object.assign(screen.style, {
  left: `${L.bezel}px`,
  top: `${L.bezel}px`,
  width: `${screenW}px`,
  height: `${screenH}px`,
  borderRadius: `${50 * L.scale}px`,
});

const caption = $("caption");
Object.assign(caption.style, {
  left: `${L.caption.x}px`,
  width: `${L.caption.w}px`,
  textAlign: L.caption.align,
});

const finale = $("finale");
const finaleLogo = $("finale-logo");
finaleLogo.src = "/__brand/7moveup-logo-source.png";
Object.assign(finaleLogo.style, { width: `${L.logo}px`, height: `${L.logo}px`, marginBottom: `${L.gap}px` });
$("wordmark").textContent = FINALE.wordmark;
$("wordmark").style.fontSize = `${L.wordmark}px`;
$("tagline").innerHTML = FINALE.tagline.replace(/\*(.+?)\*/g, '<span class="accent">$1</span>');
Object.assign($("tagline").style, { fontSize: `${L.tagline}px`, marginTop: `${L.gap * 0.6}px` });
$("url").textContent = FINALE.url;
Object.assign($("url").style, { fontSize: `${L.tagline * 0.8}px`, marginTop: `${L.gap * 0.7}px` });

// ------------------------------------------------------------------ Daten der Aufnahme
const events = await (await fetch(`/__work/${lang}/events.json`, { cache: "no-store" })).json();
const appFrames = events.frames;

// Untertitel vorbereiten: Schriftgröße so wählen, dass jede Zeile passt
await document.fonts.load(`900 ${L.caption.size}px "Inter Variable"`);
await document.fonts.ready;
const captionSizes = {};
for (const [scene, text] of Object.entries(CAPTIONS[lang])) {
  caption.innerHTML = markup(text);
  let size = L.caption.size;
  caption.style.fontSize = `${size}px`;
  // Textbreite messen (nicht die Breite des Block-Elements)
  const textWidth = (line) => {
    const range = document.createRange();
    range.selectNodeContents(line);
    return range.getBoundingClientRect().width;
  };
  const fits = () => [...caption.querySelectorAll(".line")].every((line) => textWidth(line) <= L.caption.w);
  while (!fits() && size > 40) {
    size -= 2;
    caption.style.fontSize = `${size}px`;
  }
  captionSizes[scene] = size;
}

// ------------------------------------------------------------------ Bilder laden
const appImg = $("app");
const imageCache = new Map();
async function setAppFrame(index) {
  const i = Math.max(0, Math.min(appFrames - 1, index));
  const src = `/__work/${lang}/app/${String(i).padStart(4, "0")}.jpg`;
  if (appImg.dataset.src === src) return;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    await img.decode();
    imageCache.set(src, img);
    if (imageCache.size > 6) imageCache.delete(imageCache.keys().next().value);
  }
  appImg.src = src;
  appImg.dataset.src = src;
  await appImg.decode();
}

// ------------------------------------------------------------------ Einzelteile
function sceneOf(t) {
  return SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES.at(-1);
}

/** Untertitel: rein ab Szenenstart (bzw. Claim-Zeitpunkt), raus in den letzten 0,22 s */
function renderCaption(t) {
  const scene = sceneOf(t);
  const text = CAPTIONS[lang][scene.id];
  if (!text) {
    caption.style.opacity = "0";
    return;
  }
  const inAt = scene.id === "hook" ? HOOK_CLAIM_AT : scene.start + (CONTINUOUS_CUTS.includes(scene.id) ? 0.05 : 0.2);
  const pIn = easeOut(progress(t, inAt, inAt + 0.42));
  const pOut = progress(t, scene.end - 0.22, scene.end);
  if (caption.dataset.scene !== scene.id) {
    caption.innerHTML = markup(text);
    caption.dataset.scene = scene.id;
    caption.style.fontSize = `${captionSizes[scene.id]}px`;
  }
  const h = caption.getBoundingClientRect().height;
  caption.style.top = `${L.caption.y + (L.caption.h - h) / 2}px`;
  caption.style.opacity = String(pIn * (1 - pOut));
  caption.style.transform = `translateY(${lerp(28, 0, pIn) - 16 * pOut}px)`;
  caption.style.filter = `blur(${(1 - pIn) * 8 + pOut * 6}px)`;
}

/** Handy: Hook-Zoom, Szenen-Abblende, Finale-Ausblendung */
function renderPhone(t) {
  // Hook: Startet nah am Tagesspruch, zoomt zurück, sobald der Claim kommt
  const pz = easeInOut(progress(t, 4.35, 5.25));
  let zoom = lerp(L.hookZoom, 1, pz);
  let top = lerp(L.hookTop, L.phoneTop, pz);
  let opacity = 1;

  // Finale
  const pf = easeInOut(progress(t, 27.0, 27.45));
  zoom *= lerp(1, 0.9, pf);
  top += lerp(0, 60, pf);
  opacity = 1 - pf;

  // leichtes „Atmen“ beim Szenenwechsel
  let dim = 0;
  for (const scene of SCENES.slice(1)) {
    if (scene.id === "finale" || CONTINUOUS_CUTS.includes(scene.id)) continue;
    const b = scene.start;
    if (t >= b - 0.2 && t < b) dim = Math.max(dim, progress(t, b - 0.2, b));
    if (t >= b && t < b + 0.24) dim = Math.max(dim, 1 - progress(t, b, b + 0.24));
  }
  zoom *= 1 - 0.012 * dim;

  phone.style.transform = `translateY(${top - L.phoneTop}px) scale(${zoom})`;
  phone.style.opacity = String(opacity);
  $("dim").style.opacity = String(dim);
}

/** Tap-Kreise und Hervorhebungen in App-Koordinaten */
function renderOverlays(frame) {
  const t = frame / FPS;
  const parts = [];
  for (const tap of events.taps) {
    const t0 = tap.frame / FPS - 0.12;
    const p = progress(t, t0, t0 + 0.6);
    if (t < t0 || p >= 1) continue;
    const r = 26 * L.scale * lerp(0.55, 1.35, easeOut(p));
    const alpha = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
    parts.push(
      `<div class="ripple" style="left:${tap.x * L.scale - r}px;top:${tap.y * L.scale - r}px;width:${2 * r}px;height:${2 * r}px;opacity:${alpha.toFixed(3)}"></div>`,
    );
  }
  for (const hl of events.highlights) {
    if (frame < hl.from || frame > hl.to) continue;
    const pIn = progress(frame, hl.from, hl.from + 8);
    const pOut = progress(frame, hl.to - 8, hl.to);
    const pad = 6;
    const { x, y, width, height } = hl.box;
    parts.push(
      `<div class="hl" style="left:${(x - pad) * L.scale}px;top:${(y - pad) * L.scale}px;width:${(width + 2 * pad) * L.scale}px;height:${(height + 2 * pad) * L.scale}px;opacity:${(easeOut(pIn) * (1 - pOut)).toFixed(3)}"></div>`,
    );
  }
  $("overlays").innerHTML = parts.join("");
}

function renderBrand(t) {
  const pIn = easeOut(progress(t, 0.15, 0.7));
  const pOut = progress(t, 26.9, 27.2);
  brand.style.opacity = String(pIn * (1 - pOut));
}

function renderFinale(t) {
  const pLogo = progress(t, 27.2, 27.75);
  const pWord = easeOut(progress(t, 27.42, 27.9));
  const pTag = easeOut(progress(t, 27.65, 28.15));
  const pUrl = easeOut(progress(t, 27.85, 28.3));
  finale.style.opacity = t >= 27.1 ? "1" : "0";
  finaleLogo.style.opacity = String(clamp01(pLogo * 1.6));
  finaleLogo.style.transform = `scale(${lerp(0.78, 1, easeOutBack(pLogo))})`;
  const word = $("wordmark");
  word.style.opacity = String(pWord);
  word.style.transform = `translateY(${lerp(26, 0, pWord)}px)`;
  const tag = $("tagline");
  tag.style.opacity = String(pTag);
  tag.style.transform = `translateY(${lerp(18, 0, pTag)}px)`;
  const url = $("url");
  url.style.opacity = String(FINALE.url ? pUrl : 0);
}

// ------------------------------------------------------------------ Öffentliche API für den Treiber
window.renderFrame = async (frame) => {
  const t = frame / FPS;
  await setAppFrame(Math.min(frame, appFrames - 1));
  renderPhone(t);
  renderOverlays(frame);
  renderCaption(t);
  renderBrand(t);
  renderFinale(t);
};
window.__totalFrames = Math.round(DURATION * FPS);
window.__ready = true;
