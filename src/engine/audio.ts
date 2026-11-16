import type { Pcm } from "./gemini";
import { ENVELOPE_RATE, MIX_RATE, type Line, type MusicId, type Project, type Span, type Timeline } from "./types";

// ─── Cutting one recording back into its lines ────────────────────────────────

interface Run {
  from: number;
  to: number;
}

const WINDOW_SEC = 0.02;

/** 20 ms windows: quiet or not, and where the speech starts and ends. */
function quietMap({ samples, rate }: Pcm) {
  const size = Math.round(rate * WINDOW_SEC);
  const windows = Math.floor(samples.length / size);
  const quiet: boolean[] = [];
  for (let w = 0; w < windows; w++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += samples[w * size + i] ** 2;
    // About -38 dB.
    quiet.push(Math.sqrt(sum / size) < 0.0126);
  }
  const firstLoud = quiet.indexOf(false);
  let lastLoud = quiet.length - 1;
  while (lastLoud > 0 && quiet[lastLoud]) lastLoud--;
  return { quiet, size, firstLoud, lastLoud };
}

function quietRuns(quiet: boolean[], firstLoud: number, lastLoud: number, minWindows: number): Run[] {
  const runs: Run[] = [];
  for (let w = firstLoud; w <= lastLoud; ) {
    if (!quiet[w]) {
      w++;
      continue;
    }
    const from = w;
    while (w <= lastLoud && quiet[w]) w++;
    if (w - from >= minWindows) runs.push({ from, to: w });
  }
  return runs;
}

function cutAt(pcm: Pcm, size: number, firstLoud: number, lastLoud: number, cuts: Run[]): Float32Array[] {
  const bounds = [firstLoud, ...cuts.flatMap((c) => [c.from, c.to]), lastLoud + 1];
  const parts: Float32Array[] = [];
  for (let i = 0; i <= cuts.length; i++) parts.push(pcm.samples.subarray(bounds[i * 2] * size, bounds[i * 2 + 1] * size));
  return parts;
}

/** Cuts at the pauses nearest to where each line should end, lines taking time in proportion to their length. */
function splitAtPauses(pcm: Pcm, weights: number[]): Float32Array[] | null {
  const { quiet, size, firstLoud, lastLoud } = quietMap(pcm);
  if (firstLoud < 0) return null;
  const count = weights.length;
  const runs = quietRuns(quiet, firstLoud, lastLoud, 10);
  if (runs.length < count - 1) return null;
  const total = weights.reduce((s, x) => s + x, 0);
  const span = lastLoud + 1 - firstLoud;
  const expected: number[] = [];
  let acc = 0;
  for (let i = 0; i < count - 1; i++) expected.push(firstLoud + ((acc += weights[i]) / total) * span);
  const longest = Math.max(...runs.map((r) => r.to - r.from));
  // Long pauses near where a cut is expected, chosen in order (a small dynamic programme).
  const cost = (i: number, j: number) => Math.abs((runs[j].from + runs[j].to) / 2 - expected[i]) / span - 0.35 * ((runs[j].to - runs[j].from) / longest);
  const best = expected.map(() => runs.map(() => Infinity));
  const prev = expected.map(() => runs.map(() => -1));
  for (let j = 0; j < runs.length; j++) best[0][j] = cost(0, j);
  for (let i = 1; i < expected.length; i++) {
    for (let j = i; j < runs.length; j++) {
      for (let k = i - 1; k < j; k++) {
        const c = best[i - 1][k] + cost(i, j);
        if (c < best[i][j]) {
          best[i][j] = c;
          prev[i][j] = k;
        }
      }
    }
  }
  let j = -1;
  let lowest = Infinity;
  for (let c = 0; c < runs.length; c++) if (best[expected.length - 1][c] < lowest) [lowest, j] = [best[expected.length - 1][c], c];
  const chosen: number[] = [];
  for (let i = expected.length - 1; i >= 0 && j >= 0; i--) {
    chosen.unshift(j);
    j = prev[i][j];
  }
  if (chosen.length !== count - 1) return null;
  return cutAt(pcm, size, firstLoud, lastLoud, chosen.map((c) => runs[c]));
}

/** Cuts at the longest pauses: the turns between speakers are usually the longest silences. */
function splitAtLongestPauses(pcm: Pcm, count: number): Float32Array[] | null {
  const { quiet, size, firstLoud, lastLoud } = quietMap(pcm);
  if (firstLoud < 0) return null;
  const byLength = quietRuns(quiet, firstLoud, lastLoud, 1).sort((a, b) => b.to - b.from - (a.to - a.from));
  const cuts = byLength.slice(0, count - 1);
  const next = byLength[count - 1];
  if (cuts.length !== count - 1) return null;
  const shortest = Math.min(...cuts.map((c) => c.to - c.from));
  if (next && shortest < (next.to - next.from) * 1.3) return null;
  cuts.sort((a, b) => a.from - b.from);
  return cutAt(pcm, size, firstLoud, lastLoud, cuts);
}

/** One recording of several lines, cut back into them; null when it can't be done with confidence. */
export function splitDialogue(pcm: Pcm, texts: string[]): Float32Array[] | null {
  if (texts.length === 1) return [trimSilence(pcm.samples, pcm.rate)];
  const letters = texts.map((t) => t.length);
  // Each piece should be about as long as its line is wordy; if not, a cut landed mid-line.
  const even = (parts: Float32Array[] | null): parts is Float32Array[] => {
    if (!parts) return false;
    const perLetter = parts.reduce((s, p) => s + p.length, 0) / letters.reduce((s, n) => s + n, 0);
    return parts.every((p, i) => p.length >= pcm.rate * 0.2 && p.length / (letters[i] * perLetter) >= 0.4 && p.length / (letters[i] * perLetter) <= 2.5);
  };
  const byWeight = splitAtPauses(pcm, letters);
  if (even(byWeight)) return byWeight;
  const byTurns = splitAtLongestPauses(pcm, texts.length);
  if (even(byTurns)) return byTurns;
  return null;
}

/** Drops the silence before and after the speech, keeping a breath of it. */
export function trimSilence(samples: Float32Array, rate: number): Float32Array {
  const { size, firstLoud, lastLoud } = quietMap({ samples, rate });
  if (firstLoud < 0) return samples;
  return samples.subarray(Math.max(0, (firstLoud - 2) * size), Math.min(samples.length, (lastLoud + 3) * size));
}

// ─── Lip sync ─────────────────────────────────────────────────────────────────

/**
 * The mouth, from the sound itself — so it fits any language. Opening follows
 * loudness; width follows brightness (hissy "ee/s" sounds are wide, "oo/m" round).
 */
export function mouthOf(samples: Float32Array, rate: number): { envelope: Float32Array; shape: Float32Array } {
  const size = Math.round(rate / ENVELOPE_RATE);
  const n = Math.max(1, Math.floor(samples.length / size));
  const loud = new Float32Array(n);
  const bright = new Float32Array(n);
  for (let w = 0; w < n; w++) {
    let sum = 0;
    let crossings = 0;
    for (let i = 0; i < size; i++) {
      const s = samples[w * size + i];
      sum += s * s;
      if (i && s >= 0 !== samples[w * size + i - 1] >= 0) crossings++;
    }
    loud[w] = Math.sqrt(sum / size);
    bright[w] = crossings / size;
  }
  // Loudness against this line's own loud moments, so quiet and loud voices both move the mouth fully.
  const sorted = [...loud].sort((a, b) => a - b);
  const peak = Math.max(0.01, sorted[Math.floor(sorted.length * 0.92)]);
  const envelope = new Float32Array(n);
  const shape = new Float32Array(n);
  let open = 0;
  let wide = 0.5;
  for (let w = 0; w < n; w++) {
    const target = Math.min(1, Math.max(0, loud[w] / peak - 0.1) / 0.8);
    // Opens fast, closes a little slower: mouths snap open and ease shut.
    open += (target - open) * (target > open ? 0.75 : 0.45);
    envelope[w] = open;
    const b = Math.min(1, Math.max(0, (bright[w] - 0.03) / 0.2));
    wide += (b - wide) * 0.4;
    shape[w] = wide;
  }
  return { envelope, shape };
}

/** A made-up mouth for a silent preview: syllables at a talking pace. */
function fakeMouth(seconds: number, seed: number): { envelope: Float32Array; shape: Float32Array } {
  const n = Math.max(1, Math.round(seconds * ENVELOPE_RATE));
  const envelope = new Float32Array(n);
  const shape = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / ENVELOPE_RATE;
    const edge = Math.min(1, t / 0.1, (seconds - t) / 0.12);
    envelope[i] = Math.max(0, edge) * (0.25 + 0.75 * Math.abs(Math.sin(t * 9.5 + seed) * Math.sin(t * 3.1 + seed * 2)));
    shape[i] = 0.5 + 0.5 * Math.sin(t * 4.3 + seed);
  }
  return { envelope, shape };
}

// ─── Music and sound effects, made here (nothing to license) ──────────────────

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

function pluck(out: Float32Array, at: number, note: number, gain: number, decay = 6) {
  const f = hz(note);
  const start = Math.round(at * MIX_RATE);
  const len = Math.round(MIX_RATE * 0.7);
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / MIX_RATE;
    out[start + i] += gain * Math.exp(-t * decay) * Math.min(1, t * 400) * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.12 * Math.sin(6 * Math.PI * f * t));
  }
}

function pad(out: Float32Array, at: number, len: number, notes: number[], gain: number) {
  const start = Math.round(at * MIX_RATE);
  const n = Math.round(len * MIX_RATE);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / MIX_RATE;
    const env = Math.min(1, t / 0.6, (len - t) / 0.6);
    let s = 0;
    for (const note of notes) s += Math.sin(2 * Math.PI * hz(note) * t) + 0.3 * Math.sin(2 * Math.PI * hz(note) * 2.003 * t);
    out[start + i] += (gain * Math.max(0, env) * s) / notes.length;
  }
}

/** A bed of music for the whole video. */
export function makeMusic(id: MusicId, seconds: number): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * MIX_RATE));
  if (id === "funny") {
    // Tiptoe pizzicato: bouncy and light.
    const beat = 60 / 116 / 2;
    const tune = [60, 64, 67, 64, 65, 69, 72, 69, 62, 65, 69, 65, 67, 71, 74, 67];
    const bass = [48, 53, 50, 43];
    for (let i = 0; i * beat < seconds; i++) {
      pluck(out, i * beat, tune[i % tune.length] + 12, 0.16, 9);
      if (i % 4 === 0) pluck(out, i * beat, bass[Math.floor(i / 4) % bass.length], 0.3, 4);
      if (i % 4 === 2) pluck(out, i * beat, bass[Math.floor(i / 4) % bass.length] + 12, 0.14, 7);
    }
  } else if (id === "chill") {
    const bar = 3.2;
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    for (let b = 0; b * bar < seconds; b++) {
      const chord = chords[b % chords.length];
      pad(out, b * bar, bar + 0.5, chord, 0.2);
      for (let k = 0; k < 4; k++) pluck(out, b * bar + k * (bar / 4) + bar / 8, chord[(k * 3) % 4] + 12, 0.1, 4);
    }
  } else if (id === "smooth") {
    // Slow, warm and even: soft pads, a gentle electric-piano broken chord and a round bass. Sits under a voice without fighting it.
    const bar = (60 / 72) * 4;
    const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]];
    const arp = [0, 1.5, 2, 3];
    for (let b = 0; b * bar < seconds; b++) {
      const chord = chords[b % chords.length];
      pad(out, b * bar, bar + 0.8, chord.map((n) => n + 12), 0.11);
      pluck(out, b * bar, chord[0] - 12, 0.2, 2.2);
      pluck(out, b * bar + bar * 0.625, chord[0] - 12, 0.1, 2.6);
      arp.forEach((beat, k) => pluck(out, b * bar + beat * (bar / 4), chord[(k + 1) % 4] + 12, 0.06 + (k === 0 ? 0.02 : 0), 3));
    }
    // A gentle one-pole low-pass takes the edge off the plucks.
    let y = 0;
    for (let i = 0; i < out.length; i++) {
      y += 0.18 * (out[i] - y);
      out[i] = y * 1.4;
    }
  } else if (id === "suspense") {
    for (let at = 0; at < seconds; at += 4) pad(out, at, 4.6, [38, 45, 50], 0.34);
    for (let i = 0; i * 0.5 < seconds; i++) pluck(out, i * 0.5, i % 2 ? 77 : 84, 0.05, 30);
  }
  // Fade in and out.
  const fade = Math.min(out.length / 2, MIX_RATE * 0.8);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return out;
}

/** A soft "pop" as someone starts to speak. */
function pop(out: Float32Array, at: number, gain: number) {
  const start = Math.round(at * MIX_RATE);
  const len = Math.round(MIX_RATE * 0.07);
  let phase = 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const k = i / len;
    phase += (2 * Math.PI * (500 + 700 * k)) / MIX_RATE;
    out[start + i] += gain * Math.sin(phase) * (1 - k) ** 2;
  }
}

/** A soft air "whoosh" as a new caption slides in (text-only videos). */
function whoosh(out: Float32Array, at: number, gain: number, seed = 777) {
  const start = Math.max(0, Math.round(at * MIX_RATE));
  const len = Math.round(MIX_RATE * 0.32);
  let y = 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const k = i / len;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = seed / 0x3fffffff - 1;
    // The filter opens then closes: the sound rises and passes by.
    const a = 0.02 + 0.22 * Math.sin(Math.PI * k);
    y += a * (noise - y);
    out[start + i] += gain * y * Math.sin(Math.PI * k) ** 1.5 * 3;
  }
}

/** Ba-dum-tss, after the punch line. */
function rimshot(out: Float32Array, at: number, gain: number) {
  const thump = (when: number, f: number) => {
    const start = Math.round(when * MIX_RATE);
    const len = Math.round(MIX_RATE * 0.16);
    let phase = 0;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const k = i / len;
      phase += (2 * Math.PI * f * (1 - 0.5 * k)) / MIX_RATE;
      out[start + i] += gain * Math.sin(phase) * (1 - k) ** 2;
    }
  };
  thump(at, 190);
  thump(at + 0.14, 150);
  const start = Math.round((at + 0.3) * MIX_RATE);
  const len = Math.round(MIX_RATE * 0.5);
  let seed = 12345;
  let prev = 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = seed / 0x3fffffff - 1;
    // High-passed noise: a cymbal.
    const high = noise - prev;
    prev = noise;
    out[start + i] += gain * 0.55 * high * Math.exp((-i / MIX_RATE) * 9);
  }
}

// ─── The timeline ─────────────────────────────────────────────────────────────

const LEAD_IN = 0.35;
const GAP = 0.22;
const PUNCH_PAUSE = 0.55;
const TAIL = 1.5;

function resampleInto(out: Float32Array, at: number, samples: Float32Array, rate: number, gain: number) {
  const start = Math.round(at * MIX_RATE);
  const step = rate / MIX_RATE;
  const n = Math.floor(samples.length / step);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const pos = i * step;
    const a = Math.floor(pos);
    const b = Math.min(samples.length - 1, a + 1);
    out[start + i] += gain * (samples[a] + (samples[b] - samples[a]) * (pos - a));
  }
}

/** 1 in the quiet, about 0.45 while a line is spoken, with soft slopes either side. */
function duckCurve(spans: Span[], length: number, on: boolean): Float32Array {
  const curve = new Float32Array(length).fill(1);
  if (!on) return curve;
  const slope = 0.25 * MIX_RATE;
  const low = 0.45;
  for (const s of spans) {
    const a = Math.round(s.start * MIX_RATE);
    const b = Math.round(s.end * MIX_RATE);
    for (let i = Math.max(0, a - slope); i < Math.min(length, b + slope); i++) {
      const edge = i < a ? (a - i) / slope : i > b ? (i - b) / slope : 0;
      curve[i] = Math.min(curve[i], low + (1 - low) * edge);
    }
  }
  return curve;
}

/** Every line placed in time, its mouth worked out, and the sound mixed. `voices` null makes a silent preview. */
export function buildTimeline(
  lines: Line[],
  project: Project,
  voices: Array<{ samples: Float32Array; rate: number }> | null,
  ownMusic: Float32Array | null = null,
  videoSound: Float32Array | null = null,
): Timeline {
  const spans: Span[] = [];
  let cursor = LEAD_IN;
  const gap = project.lineGap ?? GAP;
  lines.forEach((line, i) => {
    const last = i === lines.length - 1;
    if (i) cursor += last && project.punch && lines.length > 2 ? Math.max(PUNCH_PAUSE, gap) : gap;
    cursor += line.pause ?? 0;
    const voice = voices?.[i];
    const seconds = voice ? voice.samples.length / voice.rate : Math.max(1.1, line.text.length * 0.065);
    const mouth = voice ? mouthOf(voice.samples, voice.rate) : fakeMouth(seconds, i * 1.7);
    spans.push({ line, start: cursor, end: cursor + seconds, ...mouth });
    cursor += seconds;
  });
  const duration = cursor + TAIL;
  if (!voices) return { spans, duration, audio: null, silent: true };

  const audio = new Float32Array(Math.ceil(duration * MIX_RATE));
  // Music (and the video's own sound) dip while someone speaks, so the words stay clear.
  const duck = duckCurve(spans, audio.length, project.duck ?? false);
  if (project.music === "custom") {
    // The visitor's own track from where they chose, looped under the whole video and faded at both ends.
    if (ownMusic?.length) {
      const gain = 0.3 * project.musicVolume;
      const fade = MIX_RATE * 0.8;
      const skip = Math.min(ownMusic.length - 1, Math.max(0, Math.round((project.musicStart ?? 0) * MIX_RATE)));
      const loop = ownMusic.length - skip;
      for (let i = 0; i < audio.length; i++) audio[i] += ownMusic[skip + (i % loop)] * gain * duck[i] * Math.min(1, i / fade, (audio.length - i) / fade);
    }
  } else if (project.music !== "none") {
    const music = makeMusic(project.music, duration);
    const gain = 0.22 * project.musicVolume;
    for (let i = 0; i < audio.length; i++) audio[i] += music[i] * gain * duck[i];
  }
  if (project.background === "video" && videoSound?.length && (project.videoVolume ?? 0) > 0) {
    // The background video's own sound, in step with its picture (it loops the same way).
    const gain = 0.8 * (project.videoVolume ?? 0);
    const skip = Math.min(videoSound.length - 1, Math.max(0, Math.round((project.videoStart ?? 0) * MIX_RATE)));
    const loop = videoSound.length - skip;
    for (let i = 0; i < audio.length; i++) audio[i] += videoSound[skip + (i % loop)] * gain * duck[i];
  }
  spans.forEach((span, i) => resampleInto(audio, span.start, voices[i].samples, voices[i].rate, 0.95));
  if (project.sfx) {
    if (project.mode === "captions") spans.forEach((span, i) => whoosh(audio, span.start - 0.22, 0.12, 777 + i * 31));
    else spans.forEach((span, i) => i && pop(audio, span.start - 0.06, 0.1));
    if (project.punch && spans.length > 1) rimshot(audio, spans[spans.length - 1].end + 0.15, 0.3);
  }
  // A soft limiter, so music and voice together never clip.
  for (let i = 0; i < audio.length; i++) {
    const s = audio[i];
    audio[i] = Math.abs(s) < 0.8 ? s : Math.sign(s) * (0.8 + 0.2 * Math.tanh((Math.abs(s) - 0.8) / 0.2));
  }
  return { spans, duration, audio, silent: false };
}
