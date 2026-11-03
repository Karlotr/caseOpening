"use client";

// Sintetizirani zvučni efekti (Web Audio) — bez vanjskih datoteka.
import type { Rarity } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

try {
  if (typeof window !== "undefined") muted = window.localStorage.getItem("garaza-muted") === "1";
} catch {}

function ac() {
  if (typeof window === "undefined" || muted) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    window.localStorage.setItem("garaza-muted", m ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l(m));
}
export function onMuteChange(l: (m: boolean) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; delay?: number; from?: number; to?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(opts.from ?? 400, t);
  f.frequency.exponentialRampToValueAtTime(opts.to ?? 3000, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
export const rarityRank = (r: Rarity) => RANK[r];

let lastTick = 0;
export const sfx = {
  click: () => tone(900, 0.05, { type: "square", gain: 0.06 }),
  tick: () => {
    const now = performance.now();
    if (now - lastTick < 28) return;
    lastTick = now;
    tone(1400 + Math.random() * 200, 0.03, { type: "square", gain: 0.07 });
  },
  // "motor" — vrtnja kreće
  spin: () => {
    tone(70, 0.9, { type: "sawtooth", gain: 0.08, slideTo: 180 });
    noise(0.7, { gain: 0.12, from: 300, to: 2400 });
  },
  reveal: (r: Rarity) => {
    const k = RANK[r];
    const base = [392, 440, 523, 587, 659, 784][k];
    tone(base, 0.25, { type: "triangle", gain: 0.25 });
    if (k >= 2) tone(base * 1.25, 0.3, { type: "triangle", gain: 0.2, delay: 0.08 });
    if (k >= 3) tone(base * 1.5, 0.45, { type: "triangle", gain: 0.2, delay: 0.16 });
    if (k >= 4) {
      tone(base * 2, 0.7, { type: "sine", gain: 0.2, delay: 0.26 });
      noise(0.8, { gain: 0.1, from: 2000, to: 8000, delay: 0.2 });
    }
  },
  win: (tier: 1 | 2 | 3 = 1) => {
    const notes = tier === 3 ? [523, 659, 784, 1047, 1319, 1568] : tier === 2 ? [523, 659, 784, 1047] : [659, 784, 988];
    notes.forEach((n, i) => tone(n, 0.35, { type: "triangle", gain: 0.22, delay: i * 0.09 }));
    if (tier >= 2) notes.forEach((n, i) => tone(n * 2, 0.25, { type: "sine", gain: 0.08, delay: i * 0.09 + 0.04 }));
    if (tier === 3) noise(1.2, { gain: 0.12, from: 3000, to: 9000, delay: 0.3 });
  },
  lose: () => {
    tone(220, 0.25, { type: "sawtooth", gain: 0.12, slideTo: 110 });
    tone(165, 0.35, { type: "sawtooth", gain: 0.1, slideTo: 82, delay: 0.15 });
  },
  coin: () => {
    tone(1319, 0.08, { type: "square", gain: 0.08 });
    tone(1760, 0.18, { type: "square", gain: 0.08, delay: 0.07 });
  },
  count: () => tone(1800 + Math.random() * 400, 0.025, { type: "square", gain: 0.035 }),
  flip: () => noise(0.12, { gain: 0.12, from: 1500, to: 5000 }),
  door: () => {
    noise(0.6, { gain: 0.14, from: 200, to: 900 });
    tone(55, 0.6, { type: "sawtooth", gain: 0.05, slideTo: 90 });
  },
  // zlatni dijamant pogođen — uzlazni "shimmer"
  gold: () => {
    [880, 1109, 1319, 1760, 2217].forEach((n, i) => tone(n, 0.5, { type: "triangle", gain: 0.16, delay: i * 0.07 }));
    noise(0.9, { gain: 0.12, from: 3000, to: 10000, delay: 0.05 });
    tone(110, 0.8, { type: "sawtooth", gain: 0.06, slideTo: 440 });
  },
  light: () => tone(660, 0.12, { type: "square", gain: 0.08 }),
  lightsOut: () => tone(110, 0.5, { type: "sawtooth", gain: 0.1, slideTo: 300 }),
};
