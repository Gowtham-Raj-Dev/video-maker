import { splitDialogue, trimSilence } from "./audio";
import { GeminiError, speak, ttsModelName, withKeys } from "./gemini";
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

  const record = async (indexes: number[]): Promise<Float32Array[] | null> => {
    const turns = indexes.map((i) => ({ speaker: lines[i].speaker, text: lines[i].text }));
    const key = await voiceKey(["v1", ...turns.map((t) => `${voices[t.speaker]}:${t.text}`)]);
    if (!fresh) {
      const saved = await getVoice(key);
      if (saved && saved.parts.length === indexes.length) {
        indexes.forEach((i, k) => (out[i] = { samples: saved.parts[k], rate: saved.rate }));
        return saved.parts;
      }
    }
    let pcm;
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
      try {
        pcm = await withKeys(keys, (k) => speak(k, turns, voices));
        break;
      } catch (error) {
        // Free keys allow only a few voice requests a minute: wait it out twice before giving up.
        if (!(error instanceof GeminiError) || error.status !== 429 || attempt >= 2) throw error;
        onProgress({ done, total: lines.length, note: "Google's per-minute limit reached — waiting 25 seconds, then carrying on…" });
        await wait(25_000, signal);
      }
    }
    const parts = indexes.length === 1 ? [trimSilence(pcm.samples, pcm.rate)] : splitDialogue(pcm, turns.map((t) => t.text));
    if (!parts) return null;
    // Copies, not views of the big recording, so each line is stored on its own.
    const copies = parts.map((p) => p.slice());
    indexes.forEach((i, k) => (out[i] = { samples: copies[k], rate: pcm.rate }));
    await putVoice(key, { rate: pcm.rate, parts: copies });
    return copies;
  };

  for (const chunk of chunksOf(lines, perLine)) {
    onProgress({ done, total: lines.length, note: `Recording ${[...new Set(chunk.map((i) => lines[i].speaker))].join(" & ")} (${ttsModelName()})…` });
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
