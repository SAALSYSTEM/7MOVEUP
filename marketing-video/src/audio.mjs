/**
 * Tonspur, komplett synthetisch (keine fremden Audiodateien, keine Lizenzfragen):
 * - ruhiges Musikbett in A-Dur, 112 BPM (Pad, Bass, Kick, Hi-Hats), baut sich ab dem App-Teil auf
 * - die Timer-Töne exakt wie in der App (880 Hz kurz; Abschluss 660 + 990 Hz)
 * - leise Klicks für Taps und Tippen, sanfte „Pops“ für Toasts
 * Das Video funktioniert ohne Ton; der Ton ergänzt nur.
 */
import fs from "node:fs";

import { DURATION, FPS, SCENES } from "./config.mjs";

const SR = 48_000;
const BPM = 112;
const BEAT = 60 / BPM;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// A – E – F#m – D, je 2 Takte
const CHORDS = [
  { root: 45, notes: [57, 61, 64, 69] }, // A
  { root: 40, notes: [56, 59, 64, 68] }, // E
  { root: 42, notes: [57, 61, 66, 69] }, // F#m
  { root: 38, notes: [57, 62, 66, 69] }, // D
];
const CHORD_LEN = 8 * BEAT;

function chordAt(t) {
  return CHORDS[Math.floor(t / CHORD_LEN) % CHORDS.length];
}

function makeBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}

/** einfacher deterministischer Rauschgenerator */
function noise(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

function addTone(buf, start, dur, freq, amp, { attack = 0.008, type = "sine", decay = null } = {}) {
  const i0 = Math.max(0, Math.floor(start * SR));
  const n = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && i0 + i < buf.length; i += 1) {
    const t = i / SR;
    const env = decay ? Math.min(1, t / attack) * Math.exp(-t / decay) : Math.min(1, t / attack) * Math.max(0, 1 - t / dur) ** 1.5;
    phase += (2 * Math.PI * freq) / SR;
    const v = type === "sine" ? Math.sin(phase) : Math.sin(phase) + 0.25 * Math.sin(2 * phase);
    buf[i0 + i] += v * amp * env;
  }
}

// ------------------------------------------------------------------ Musik
function renderMusic(seconds) {
  const pad = makeBuffer(seconds);
  const bass = makeBuffer(seconds);
  const drums = makeBuffer(seconds);
  const rnd = noise(7);

  const appStart = SCENES.find((s) => s.id === "session").start;
  const lift = SCENES.find((s) => s.id === "plans").start;
  const finaleStart = SCENES.find((s) => s.id === "finale").start;

  // Pad: verstimmte Sägezähne, weich gefiltert, langsame Hüllkurve je Akkord
  const voices = [];
  for (let c = 0; c * CHORD_LEN < seconds; c += 1) voices.push({ start: c * CHORD_LEN, chord: CHORDS[c % CHORDS.length] });
  let lp = 0;
  for (let i = 0; i < pad.length; i += 1) {
    const t = i / SR;
    let s = 0;
    for (const v of voices) {
      const local = t - v.start;
      if (local < -0.05 || local > CHORD_LEN + 0.6) continue;
      const env = Math.min(1, Math.max(0, local + 0.05) / 0.6) * Math.min(1, Math.max(0, CHORD_LEN + 0.6 - local) / 0.6);
      for (const n of v.chord.notes) {
        for (const det of [-0.06, 0.06]) {
          const f = midi(n + det);
          const ph = (t * f) % 1;
          s += (2 * ph - 1) * env * 0.5;
        }
      }
    }
    // Filter öffnet sich mit dem Spannungsbogen
    const open = t < 4.9 ? 0.04 : t < appStart ? 0.06 : 0.08;
    lp += open * (s - lp);
    pad[i] = lp * 0.05;
  }

  // Kick + Bass + Hats + Clap auf dem Raster
  const kickEnv = makeBuffer(seconds);
  for (let b = 0; b * BEAT < seconds; b += 1) {
    const t = b * BEAT;
    const inBody = t >= appStart - 0.01 && t < finaleStart - 0.01;
    if (inBody || Math.abs(t - finaleStart) < BEAT / 2) {
      // Kick
      const i0 = Math.floor(t * SR);
      let ph = 0;
      for (let i = 0; i < 0.32 * SR && i0 + i < drums.length; i += 1) {
        const lt = i / SR;
        const f = 48 + 90 * Math.exp(-lt / 0.035);
        ph += (2 * Math.PI * f) / SR;
        drums[i0 + i] += Math.sin(ph) * Math.exp(-lt / 0.11) * 0.3;
        kickEnv[i0 + i] = Math.max(kickEnv[i0 + i], Math.exp(-lt / 0.16));
      }
      // Bass (Grundton, Achtel)
      const root = midi(chordAt(t).root);
      addTone(bass, t + 0.02, BEAT * 0.45, root, 0.12, { attack: 0.01, type: "warm", decay: 0.18 });
      addTone(bass, t + BEAT / 2, BEAT * 0.4, root, 0.08, { attack: 0.01, type: "warm", decay: 0.14 });
    }
    if (inBody) {
      // Hi-Hat auf der Offbeat-Achtel
      const h0 = Math.floor((t + BEAT / 2) * SR);
      let hp = 0;
      let prev = 0;
      for (let i = 0; i < 0.045 * SR && h0 + i < drums.length; i += 1) {
        const x = rnd();
        hp = 0.92 * (hp + x - prev);
        prev = x;
        drums[h0 + i] += hp * Math.exp(-(i / SR) / 0.01) * 0.03;
      }
      // Clap auf 2 und 4 ab dem zweiten Teil
      if (t >= lift && b % 2 === 1) {
        const c0 = Math.floor(t * SR);
        let bp = 0;
        for (let i = 0; i < 0.16 * SR && c0 + i < drums.length; i += 1) {
          bp += 0.35 * (rnd() - bp);
          drums[c0 + i] += bp * Math.exp(-(i / SR) / 0.05) * 0.1;
        }
      }
    }
  }
  // Hook-Riser in den Claim
  let rlp = 0;
  for (let i = Math.floor(3.9 * SR); i < 4.9 * SR; i += 1) {
    const p = (i / SR - 3.9) / 1.0;
    rlp += (0.02 + 0.1 * p) * (rnd() - rlp);
    drums[i] += rlp * 0.05 * p * p;
  }

  // Finale: Akkordschlag mit langem Ausklang
  for (const n of [45, 57, 61, 64, 69, 73]) addTone(pad, finaleStart + 0.2, 2.8, midi(n), 0.035, { attack: 0.01, decay: 1.1 });

  // Mischen mit leichtem Sidechain-Ducking
  const music = makeBuffer(seconds);
  for (let i = 0; i < music.length; i += 1) {
    const duck = 1 - 0.45 * kickEnv[i];
    music[i] = (pad[i] + bass[i]) * duck + drums[i];
  }
  // Ein- und Ausblenden
  for (let i = 0; i < music.length; i += 1) {
    const t = i / SR;
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, Math.max(0, (seconds - t) / 1.6));
    music[i] *= fadeIn * fadeOut;
  }
  return music;
}

// ------------------------------------------------------------------ Effekte
function renderSfx(seconds, events) {
  const sfx = makeBuffer(seconds);
  const rnd = noise(11);
  const at = (frame) => frame / FPS;

  // Tap: weicher, kurzer Klick (Sinus-Blip + Hauch Rauschen)
  for (const tap of events.taps) {
    const t = at(tap.frame);
    addTone(sfx, t, 0.05, 1320, 0.07, { attack: 0.002, decay: 0.012 });
    addTone(sfx, t, 0.08, 220, 0.12, { attack: 0.002, decay: 0.02 });
  }
  // Tippen: sehr leise Tastenklicks
  for (const key of events.typing) {
    const i0 = Math.floor(at(key.frame) * SR);
    let klp = 0;
    for (let i = 0; i < 0.014 * SR && i0 + i < sfx.length; i += 1) {
      klp += 0.25 * (rnd() - klp);
      sfx[i0 + i] += klp * Math.exp(-(i / SR) / 0.003) * 0.06;
    }
  }
  // Toast-Pop: kleine Terz nach oben
  for (const pop of events.pops) {
    const t = at(pop.frame);
    addTone(sfx, t, 0.12, midi(76), 0.07, { attack: 0.004, decay: 0.05 });
    addTone(sfx, t + 0.06, 0.16, midi(81), 0.06, { attack: 0.004, decay: 0.06 });
  }
  // Timer-Töne wie in der App (feedback.ts): 880 Hz 0,12 s; Abschluss 660 Hz 0,18 s + 990 Hz 0,5 s
  for (const tone of events.tones) {
    const t = at(tone.frame);
    if (Math.round(tone.f) === 880) addTone(sfx, t, 0.12, 880, 0.3, { attack: 0.012 });
    else if (Math.round(tone.f) === 660) addTone(sfx, t, 0.18, 660, 0.3, { attack: 0.012 });
    else if (Math.round(tone.f) === 990) addTone(sfx, t, 0.5, 990, 0.34, { attack: 0.012 });
  }
  return sfx;
}

function writeWav(file, left, right) {
  const n = left.length;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

export function renderAudio(file, events, { music = true } = {}) {
  const seconds = DURATION;
  const bed = music ? renderMusic(seconds) : makeBuffer(seconds);
  const sfx = renderSfx(seconds, events);
  const left = makeBuffer(seconds);
  const right = makeBuffer(seconds);
  let peak = 0;
  for (let i = 0; i < left.length; i += 1) {
    const m = bed[i] * 0.9;
    const s = sfx[i];
    // Musik minimal in die Breite, Effekte mittig
    const l = Math.tanh((m * 1.02 + s) * 1.1);
    const r = Math.tanh((m * 0.98 + s) * 1.1);
    left[i] = l;
    right[i] = r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const gain = peak > 0 ? 0.89 / peak : 1; // ca. −1 dBFS Spitze
  for (let i = 0; i < left.length; i += 1) {
    left[i] *= gain;
    right[i] *= gain;
  }
  writeWav(file, left, right);
}
