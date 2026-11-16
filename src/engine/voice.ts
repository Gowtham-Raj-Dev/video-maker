import { splitDialogue, trimSilence } from "./audio";
import { GeminiError, activeSlot, speak, withPool } from "./gemini";
import { getVoice, putVoice, voiceKey } from "./store";
import type { CastMember, Line } from "./types";

export interface LineVoice {
  samples: Float32Array;
  rate: number;
}

export interface VoiceProgress {
  done: number;
  total: number;
  note: string;
}

/** Runs of lines Gemini can voice in one request: at most two speakers, and not too long to cut apart again. */
function chunksOf(lines: Line[], perLine: boolean): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let speakers = new Set<string>();
  let letters = 0;
  lines.forEach((line, i) => {
    const fits = !perLine && current.length < 6 && letters + line.text.length <= 700 && new Set([...speakers, line.speaker]).size <= 2;
    if (current.length && !fits) {
      chunks.push(current);
      current = [];
      speakers = new Set();
      letters = 0;
    }
    current.push(i);
    speakers.add(line.speaker);
    letters += line.text.length;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Stopped", "AbortError"));
    }, { once: true });
  });

/** Every line's voice from this browser's store, or null if any line was never recorded. Spends nothing. */
export async function cachedVoices(lines: Line[], cast: CastMember[]): Promise<LineVoice[] | null> {
  if (!lines.length) return null;
  const voices = Object.fromEntries(cast.map((c) => [c.name, c.voice]));
  const out: LineVoice[] = [];
  for (const line of lines) {
    const saved = await getVoice(await voiceKey(["v1", `${voices[line.speaker]}:${line.text}`]));
    if (!saved || saved.parts.length !== 1) return null;
    out.push({ samples: saved.parts[0], rate: saved.rate });
  }
  return out;
}

/**
 * A voice for every line. Lines already recorded (same words, same voice) come
 * from this browser's store, so changing the look of a video never spends the
 * key's limit again.
 */
export async function recordVoices(
  lines: Line[],
  cast: CastMember[],
  keys: string[],
  perLine: boolean,
  fresh: boolean,
  onProgress: (p: VoiceProgress) => void,
  signal?: AbortSignal,
): Promise<LineVoice[]> {
  const voices = Object.fromEntries(cast.map((c) => [c.name, c.voice]));
  const out: LineVoice[] = new Array(lines.length);
  let done = 0;

  /** Each line is also kept on its own, so editing one line later records only that line again. */
  const lineKey = (i: number) => voiceKey(["v1", `${voices[lines[i].speaker]}:${lines[i].text}`]);
  const keepEach = async (indexes: number[], parts: Float32Array[], rate: number) => {
    if (indexes.length < 2) return;
    for (let k = 0; k < indexes.length; k++) await putVoice(await lineKey(indexes[k]), { rate, parts: [parts[k]] });
  };

  const record = async (indexes: number[]): Promise<Float32Array[] | null> => {
    const turns = indexes.map((i) => ({ speaker: lines[i].speaker, text: lines[i].text }));
    const key = await voiceKey(["v1", ...turns.map((t) => `${voices[t.speaker]}:${t.text}`)]);
    if (!fresh) {
      const saved = await getVoice(key);
      if (saved && saved.parts.length === indexes.length) {
        indexes.forEach((i, k) => (out[i] = { samples: saved.parts[k], rate: saved.rate }));
        await keepEach(indexes, saved.parts, saved.rate);
        return saved.parts;
      }
    }
    let pcm;
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
      try {
        // Every key × every voice model, in turn: a used-up one hands over to the next by itself.
        pcm = await withPool(keys, "tts", (k, model) => speak(k, model, turns, voices));
        break;
      } catch (error) {
        // Every pair is only resting for a minute: wait until the first is free, then carry on.
        if (!(error instanceof GeminiError) || error.status !== 429 || error.daily || attempt >= 6 || error.retryMs > 3 * 60_000) throw error;
        const seconds = Math.ceil(error.retryMs / 1000) + 1;
        onProgress({ done, total: lines.length, note: `${keys.length > 1 ? "All keys are" : "The key is"} at Google's per-minute limit — carrying on in ${seconds} s…` });
        await wait(seconds * 1000, signal);
      }
    }
    const parts = indexes.length === 1 ? [trimSilence(pcm.samples, pcm.rate)] : splitDialogue(pcm, turns.map((t) => t.text));
    if (!parts) return null;
    // Copies, not views of the big recording, so each line is stored on its own.
    const copies = parts.map((p) => p.slice());
    indexes.forEach((i, k) => (out[i] = { samples: copies[k], rate: pcm.rate }));
    await putVoice(key, { rate: pcm.rate, parts: copies });
    await keepEach(indexes, copies, pcm.rate);
    return copies;
  };

  // Lines already recorded on their own (same words, same voice) need no request at all.
  const missing: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const saved = fresh ? null : await getVoice(await lineKey(i));
    if (saved && saved.parts.length === 1) out[i] = { samples: saved.parts[0], rate: saved.rate };
    else missing.push(i);
  }
  done = lines.length - missing.length;
  // Runs of the lines still to record (positions in `missing`), back to line numbers.
  const runs = chunksOf(missing.map((i) => lines[i]), perLine).map((run) => run.map((k) => missing[k]));

  for (const chunk of runs) {
    const slot = activeSlot();
    const via = slot ? ` · key ${keys.indexOf(slot.key) + 1}, ${slot.model}` : "";
    onProgress({ done, total: lines.length, note: `Recording ${[...new Set(chunk.map((i) => lines[i].speaker))].join(" & ")}${via}…` });
    const parts = await record(chunk);
    if (!parts) {
      // The pauses weren't clear enough to cut this run apart: record its lines one by one instead.
      for (const i of chunk) {
        onProgress({ done, total: lines.length, note: `Recording ${lines[i].speaker}, line by line…` });
        await record([i]);
        done++;
      }
    } else {
      done += chunk.length;
    }
    onProgress({ done, total: lines.length, note: "" });
  }
  return out;
}
