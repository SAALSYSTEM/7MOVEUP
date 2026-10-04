/**
 * Töne über die Web Audio API (keine Audiodateien) und optionale Vibration.
 * Der AudioContext wird erst nach einer Nutzerinteraktion erzeugt/entsperrt (iOS-Regeln).
 */

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let soundEnabled = true;
let hapticsEnabled = true;

export function configureFeedback(options: { sound: boolean; haptics: boolean }) {
  soundEnabled = options.sound;
  hapticsEnabled = options.haptics;
}

function getContextCtor(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

/** Muss aus einem Tap-/Klick-Handler heraus aufgerufen werden. */
export function unlockAudio() {
  const Ctor = getContextCtor();
  if (!Ctor) return;
  try {
    if (!context) context = new Ctor();
    if (context.state === "suspended") void context.resume();
    // stiller Puffer entsperrt Audio zuverlässig auf iOS
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch {
    context = null;
  }
}

function tone(frequency: number, durationSec: number, startOffset = 0, volume = 0.22) {
  if (!soundEnabled || !context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime + startOffset;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + durationSec + 0.02);
  } catch {
    // Audio ist optional
  }
}

function vibrate(pattern: number | number[]) {
  if (!hapticsEnabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // nicht unterstützt (z. B. iOS Safari)
  }
}

/** kurzer Piepton für die letzten 3 Sekunden */
export function countdownBeep() {
  tone(880, 0.12);
  vibrate(40);
}

/** längerer, anderer Abschlusston bei 0 */
export function finishSignal() {
  tone(660, 0.18, 0);
  tone(990, 0.5, 0.17, 0.26);
  vibrate([120, 60, 220]);
}

/** dezentes Feedback beim Abhaken eines Satzes */
export function tick() {
  vibrate(12);
}

export function isVibrationSupported() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}
