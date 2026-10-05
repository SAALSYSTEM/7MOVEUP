/**
 * Töne über die Web Audio API (keine Audiodateien) und Haptik.
 *
 * iOS-Besonderheiten (Safari und Home-Bildschirm-App):
 * - Der AudioContext startet nur innerhalb einer Nutzerinteraktion (touchend/click/keydown).
 * - Nach Bildschirmsperre, App-Wechsel oder Anruf steht er auf „interrupted“ bzw. „suspended“.
 *   Deshalb ist `unlockAudio()` idempotent und wird bei jeder Interaktion aufgerufen, und
 *   Töne warten bei Bedarf auf `resume()`.
 * - Im Lautlos-Modus bleibt Web-Audio auf dem iPhone stumm (Musik anderer Apps läuft weiter).
 * - `navigator.vibrate` gibt es auf iOS nicht. Ersatz: Safari löst beim Umschalten eines
 *   `<input type="checkbox" switch>` (ab iOS 18) eine kurze Haptik aus – seit iOS 26.5 nur
 *   noch bei einem echten Fingertipp (siehe `HapticTap`). Der Skript-Impuls unten wirkt nur
 *   auf älteren iOS-Versionen; auf neueren bleibt er folgenlos.
 */

type AudioContextCtor = typeof AudioContext;
type Note = { frequency: number; duration: number; offset?: number; volume?: number };

/** Töne, deren Wiederaufnahme länger dauert, sind veraltet und werden verworfen. */
const MAX_RESUME_DELAY_MS = 800;
const PULSE_GAP_MS = 140;

let context: AudioContext | null = null;
let soundEnabled = true;
let hapticsEnabled = true;
let hapticSwitch: HTMLLabelElement | null = null;

export function configureFeedback(options: { sound: boolean; haptics: boolean }) {
  soundEnabled = options.sound;
  hapticsEnabled = options.haptics;
}

function getContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

function getContext(): AudioContext | null {
  if (context && context.state !== "closed") return context;
  const Ctor = getContextCtor();
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * Aus einem Tap-/Klick-Handler heraus aufrufen. Erzeugt den AudioContext bzw. setzt ihn fort
 * (auch nach „interrupted“) – beliebig oft aufrufbar.
 */
export function unlockAudio() {
  const ctx = getContext();
  if (!ctx || ctx.state === "running") return;
  try {
    void ctx.resume().catch(() => {});
    // stiller Puffer innerhalb der Geste entsperrt die Ausgabe auf iOS zuverlässig
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Audio ist optional
  }
}

/** Ohne Geste fortsetzen (z. B. bei Rückkehr in die App) – klappt, sofern der Browser es erlaubt. */
export function resumeAudio() {
  if (context && context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
}

function schedule(ctx: AudioContext, notes: Note[]) {
  const now = ctx.currentTime;
  for (const { frequency, duration, offset = 0, volume = 0.22 } of notes) {
    const start = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

function play(notes: Note[]) {
  if (!soundEnabled || !context) return;
  const ctx = context;
  try {
    if (ctx.state === "running") {
      schedule(ctx, notes);
      return;
    }
    if (ctx.state === "closed") return;
    // „suspended“ oder iOS-„interrupted“: erst fortsetzen, dann spielen
    const requestedAt = Date.now();
    ctx
      .resume()
      .then(() => {
        if (ctx.state === "running" && Date.now() - requestedAt <= MAX_RESUME_DELAY_MS) schedule(ctx, notes);
      })
      .catch(() => {});
  } catch {
    // Audio ist optional
  }
}

// ------------------------------------------------------------------ Haptik

/** iPhone/iPad (auch iPadOS mit Desktop-User-Agent) */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type HapticsSupport = "vibrate" | "ios" | "none";

export function getHapticsSupport(): HapticsSupport {
  if (typeof navigator === "undefined") return "none";
  if (typeof navigator.vibrate === "function") return "vibrate";
  if (isIOS()) return "ios";
  return "none";
}

/**
 * Ein kurzer iOS-Haptikimpuls über einen versteckten Switch (display:none → nie fokussierbar).
 * Nur iOS 18 bis 26.4; ab 26.5 ignoriert iOS per Skript ausgelöste Umschaltungen.
 */
function switchPulse() {
  if (typeof document === "undefined") return;
  try {
    if (!hapticSwitch || !hapticSwitch.isConnected) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      hapticSwitch = label;
    }
    hapticSwitch.click();
  } catch {
    // Haptik ist optional
  }
}

/**
 * @param pattern Vibrationsmuster für Geräte mit `navigator.vibrate`
 * @param pulses Anzahl kurzer Impulse als iOS-Ersatz (der erste sofort, damit er in der Geste liegt)
 */
function haptic(pattern: number | number[], pulses: number) {
  if (!hapticsEnabled) return;
  const support = getHapticsSupport();
  if (support === "vibrate") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // nicht unterstützt
    }
  } else if (support === "ios") {
    switchPulse();
    for (let i = 1; i < pulses; i += 1) window.setTimeout(switchPulse, i * PULSE_GAP_MS);
  }
}

// ------------------------------------------------------------------ Signale

/** kurzer Piepton für die letzten 3 Sekunden */
export function countdownBeep() {
  play([{ frequency: 880, duration: 0.12 }]);
  haptic(40, 1);
}

/** längerer, anderer Abschlusston bei 0 */
export function finishSignal() {
  play([
    { frequency: 660, duration: 0.18 },
    { frequency: 990, duration: 0.5, offset: 0.17, volume: 0.26 },
  ]);
  haptic([120, 60, 220], 3);
}

/**
 * dezentes Feedback beim Abhaken eines Satzes. Auf iOS übernimmt das die Switch-Fläche
 * (`HapticTap`) direkt unter dem Finger – sonst gäbe es dort einen doppelten Impuls.
 */
export function tick() {
  if (getHapticsSupport() === "ios") return;
  haptic(12, 1);
}
