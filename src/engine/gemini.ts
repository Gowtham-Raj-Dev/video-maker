/**
 * Everything that talks to Google's Gemini API — straight from the browser,
 * with the visitor's own key. Nothing goes through a server of ours.
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";

export class GeminiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** For a 429: true when it is the day's limit (not the minute's). */
    public daily = false,
    /** For a 429: how long Google says to wait, in ms. */
    public retryMs = 0,
  ) {
    super(message);
  }
}

interface ApiError {
  error?: { status?: string; message?: string; details?: Array<{ retryDelay?: string; violations?: Array<{ quotaId?: string }> }> };
}

/** Plain words for the errors people actually hit. */
function explain(status: number, json: ApiError): string {
  const detail = json.error?.message ?? "";
  if (status === 400 && /API key not valid/i.test(detail)) return "That API key isn't valid. Copy it again from Google AI Studio.";
  if (status === 403) return "This API key isn't allowed to use the Gemini API. Make a new key in Google AI Studio.";
  if (status === 429) return "This key's free limit is used up for now. Wait a while (the daily limit resets once a day), or add another key.";
  if (status === 404) return "Google no longer offers this model.";
  if (status >= 500) return "Google's server had a problem. Try again in a minute.";
  return detail || `Gemini request failed (${status}).`;
}

async function call<T>(key: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { "x-goog-api-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GeminiError(0, "Couldn't reach Google. Check your internet connection.");
  }
  const json = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    const details = json.error?.details ?? [];
    const quotaIds = details.flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? "").join(" ");
    const daily = res.status === 429 && (/PerDay/i.test(quotaIds) || /per day|daily/i.test(json.error?.message ?? ""));
    const delay = details.map((d) => d.retryDelay).find(Boolean);
    const retryMs = delay ? Math.ceil(parseFloat(delay) * 1000) : 0;
    throw new GeminiError(res.status, explain(res.status, json), daily, retryMs);
  }
  return json;
}

export const splitKeys = (text: string) => [...new Set(text.split(/[\s,;]+/).map((k) => k.trim()).filter(Boolean))];

// ─── The key pool: every key × every model it can use ─────────────────────────
//
// Google's free limits count per key AND per model, so when one model of a key
// is used up its other models still work, and then the next key's. A used-up
// pair rests until Google says it is free again (a minute, or the next day).

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

export type ModelKind = "tts" | "text";

const modelCache = new Map<string, ModelInfo[]>();
/** Keys Google refused outright (invalid, not allowed): skipped for this visit. */
const deadKeys = new Map<string, string>();
/** "key|model" → when it may be used again (ms). Day limits are remembered across visits. */
const resting = new Map<string, number>();
const REST_STORE = "videomaker.resting.v1";
const listeners = new Set<() => void>();
let active: { key: string; model: string; kind: ModelKind } | null = null;

const slotId = (key: string, model: string) => `${key}|${model}`;
/** The stored id: the key's tail only, so the full key is never written twice. */
const storeId = (key: string, model: string) => `${key.slice(-8)}|${model}`;

function loadResting() {
  try {
    const saved = JSON.parse(localStorage.getItem(REST_STORE) ?? "{}") as Record<string, number>;
    return Object.entries(saved).filter(([, until]) => until > Date.now());
  } catch {
    return [];
  }
}

function saveDaily(key: string, model: string, until: number) {
  try {
    const now = Date.now();
    const saved = Object.fromEntries(loadResting().filter(([, u]) => u > now));
    saved[storeId(key, model)] = until;
    localStorage.setItem(REST_STORE, JSON.stringify(saved));
  } catch {
    // Not remembered: it is found out again next visit.
  }
}

function restUntil(key: string, model: string): number {
  const mem = resting.get(slotId(key, model)) ?? 0;
  if (mem > Date.now()) return mem;
  const stored = loadResting().find(([id]) => id === storeId(key, model))?.[1] ?? 0;
  return stored > Date.now() ? stored : 0;
}

const emit = () => listeners.forEach((fn) => fn());
/** Tells the page when a key's state changes (to redraw the key list). */
export function onPoolChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Google's free limits reset at midnight Pacific time. */
export function nextDailyReset(): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0) % 24;
  const elapsed = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000;
  return Date.now() + (24 * 3600 * 1000 - elapsed) + 60_000;
}

async function listModels(key: string): Promise<ModelInfo[]> {
  const hit = modelCache.get(key);
  if (hit) return hit;
  const all: ModelInfo[] = [];
  let page = "";
  do {
    const json = await call<{ models?: ModelInfo[]; nextPageToken?: string }>(key, `models?pageSize=200${page ? `&pageToken=${page}` : ""}`);
    all.push(...(json.models ?? []));
    page = json.nextPageToken ?? "";
  } while (page);
  modelCache.set(key, all);
  return all;
}

const version = (name: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
const short = (name: string) => name.replace(/^models\//, "");

/** Every model of a kind this key can use, best first: flash (it has the free limit) before pro, stable before preview, newest first. */
async function modelsOf(key: string, kind: ModelKind): Promise<string[]> {
  const all = await listModels(key);
  const rough = (name: string) => Number(/lite|preview|exp/i.test(name));
  if (kind === "tts") {
    const tts = all.filter((m) => /tts/i.test(m.name) && (m.supportedGenerationMethods?.includes("generateContent") ?? true));
    tts.sort((a, b) => Number(/flash/.test(b.name)) - Number(/flash/.test(a.name)) || version(b.name) - version(a.name) || rough(a.name) - rough(b.name));
    return tts.map((m) => short(m.name));
  }
  const usable = all.filter(
    (m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name) && !/tts|image|live|embedding|audio|vision|robotics|computer/i.test(m.name),
  );
  usable.sort((a, b) => Number(/flash/.test(b.name)) - Number(/flash/.test(a.name)) || rough(a.name) - rough(b.name) || version(b.name) - version(a.name));
  return usable.map((m) => short(m.name));
}

const isKeyProblem = (e: GeminiError) => e.status === 403 || e.status === 401 || (e.status === 400 && /key/i.test(e.message));

/**
 * Runs `job` on the first key × model pair that is free, moving on by itself
 * when one is used up, refused or retired. When every pair is only resting for
 * a minute, the error carries `retryMs`: how long until the first one is free.
 */
export async function withPool<T>(keys: string[], kind: ModelKind, job: (key: string, model: string) => Promise<T>): Promise<T> {
  if (!keys.length) throw new GeminiError(401, "Add your Gemini API key first.");
  let last: GeminiError | null = null;
  let soonest = Infinity;
  for (const key of keys) {
    if (deadKeys.has(key)) continue;
    let models: string[];
    try {
      models = await modelsOf(key, kind);
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      last = e;
      if (isKeyProblem(e)) {
        deadKeys.set(key, e.message);
        emit();
      } else if (e.status === 0) throw e;
      continue;
    }
    if (!models.length) {
      last = new GeminiError(404, kind === "tts" ? "This key has no Gemini speech (TTS) model." : "This key has no Gemini text model.");
      continue;
    }
    for (const model of models) {
      const until = restUntil(key, model);
      if (until) {
        soonest = Math.min(soonest, until);
        continue;
      }
      try {
        const result = await job(key, model);
        if (active?.key !== key || active.model !== model) {
          active = { key, model, kind };
          emit();
        }
        return result;
      } catch (e) {
        if (!(e instanceof GeminiError)) throw e;
        last = e;
        if (e.status === 429) {
          const until = e.daily ? nextDailyReset() : Date.now() + Math.max(e.retryMs, 20_000);
          resting.set(slotId(key, model), until);
          if (e.daily) saveDaily(key, model, until);
          soonest = Math.min(soonest, until);
          emit();
          continue;
        }
        if (e.status === 404) {
          // Retired or not for this key: don't ask it again this visit.
          resting.set(slotId(key, model), Number.MAX_SAFE_INTEGER);
          continue;
        }
        if (isKeyProblem(e)) {
          deadKeys.set(key, e.message);
          emit();
          break;
        }
        if (e.status >= 500) continue;
        throw e;
      }
    }
  }
  const usable = keys.filter((k) => !deadKeys.has(k)).length;
  if (soonest < Infinity) {
    const wait = soonest - Date.now();
    const at = new Date(soonest).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const message =
      wait < 5 * 60_000
        ? `All ${usable > 1 ? `${usable} keys are` : "of this key's models are"} at Google's per-minute limit — free again in ${Math.ceil(wait / 1000)} s.`
        : `${usable > 1 ? `All ${usable} keys have` : "This key has"} used today's free ${kind === "tts" ? "voice" : "text"} limit on every model. It resets at ${at} — or add another key.`;
    throw new GeminiError(429, message, wait >= 5 * 60_000, Math.max(0, wait));
  }
  if (!usable) throw last && isKeyProblem(last) ? new GeminiError(last.status, keys.length > 1 ? "None of your keys work. Check them in the API key tab." : last.message) : last ?? new GeminiError(401, "Add your Gemini API key first.");
  throw last ?? new GeminiError(500, "Gemini didn't answer. Try again.");
}

/** Kept for older callers: any model of the text kind. */
export function withKeys<T>(keys: string[], job: (key: string, model: string) => Promise<T>): Promise<T> {
  return withPool(keys, "text", job);
}

export interface KeyReport {
  /** Why Google refused it, if it did. */
  dead?: string;
  /** How many voice / text models it has (once known). */
  tts?: number;
  text?: number;
  /** Voice models resting right now, and when the first comes back. */
  ttsResting: number;
  backAt?: number;
  active: boolean;
}

/** What is known about one key, for the key list. */
export function keyReport(key: string): KeyReport {
  const models = modelCache.get(key);
  const report: KeyReport = { dead: deadKeys.get(key), ttsResting: 0, active: active?.key === key };
  if (!models) return report;
  const tts = models.filter((m) => /tts/i.test(m.name)).map((m) => short(m.name));
  report.tts = tts.length;
  report.text = models.filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name) && !/tts|image|live|embedding|audio|vision|robotics|computer/i.test(m.name)).length;
  const rests = tts.map((m) => restUntil(key, m)).filter(Boolean);
  report.ttsResting = rests.length;
  if (rests.length) report.backAt = Math.min(...rests);
  return report;
}

/** The pair used last: which key (its place in the list) and which model. */
export const activeSlot = () => active;

/** Checks a key works; how many voice and text models it can use. */
export async function checkKey(key: string): Promise<{ tts: number; text: number }> {
  modelCache.delete(key);
  deadKeys.delete(key);
  try {
    const [tts, text] = await Promise.all([modelsOf(key, "tts"), modelsOf(key, "text")]);
    emit();
    return { tts: tts.length, text: text.length };
  } catch (e) {
    if (e instanceof GeminiError && isKeyProblem(e)) deadKeys.set(key, e.message);
    emit();
    throw e;
  }
}

export interface Pcm {
  samples: Float32Array;
  rate: number;
}

interface Turn {
  speaker: string;
  text: string;
}

/**
 * One recording of a run of lines: one or two speakers (Gemini's limit), each
 * with their voice. Two speakers in one request sound like a real conversation.
 */
export async function speak(key: string, model: string, turns: Turn[], voices: Record<string, string>): Promise<Pcm> {
  const speakers = [...new Set(turns.map((t) => t.speaker))];
  if (speakers.length < 1 || speakers.length > 2) throw new Error(`Gemini voices one or two speakers at a time, not ${speakers.length}.`);
  const speechConfig =
    speakers.length === 1
      ? { voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speakers[0]] } } }
      : { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map((speaker) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speaker] } } })) } };
  const body = {
    contents: [{ role: "user", parts: turns.map((t) => (speakers.length === 1 ? { text: t.text } : { text: t.text, speechMetadata: { speaker: t.speaker } })) }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig },
  };
  type Reply = { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }> };
  const json = await call<Reply>(key, `models/${model}:generateContent`, body);
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline) throw new GeminiError(500, "Gemini returned no voice for this line. Try again, or reword it.");
  const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  const wav = bytes.length > 44 && tag(0) === "RIFF";
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType)?.[1] ?? (wav ? view.getUint32(24, true) : 24_000));
  // A WAV's sound starts after its "data" chunk header, which other chunks may come before.
  let from = 0;
  let end = bytes.length;
  if (wav) {
    from = 44;
    for (let at = 12; at + 8 <= bytes.length; ) {
      const size = view.getUint32(at + 4, true);
      if (tag(at) === "data") {
        from = at + 8;
        end = Math.min(bytes.length, from + size);
        break;
      }
      at += 8 + size + (size & 1);
    }
  }
  const samples = new Float32Array(Math.floor((end - from) / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(from + i * 2, true) / 32768;
  return { samples, rate };
}

async function write(key: string, model: string, prompt: string, json: boolean): Promise<string> {
  type Reply = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const reply = await call<Reply>(key, `models/${model}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: json ? 0.7 : 1.1, ...(json ? { responseMimeType: "application/json" } : {}) },
  });
  const text = (reply.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new GeminiError(500, "Gemini wrote nothing. Try again.");
  return text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

const LANGUAGE_RULES: Record<string, string> = {
  tamil: "Write every line in spoken, everyday Tamil, in Tamil script.",
  tanglish: "Write every line twice, separated by ' | ': first in spoken everyday Tamil in Tamil script (this is read aloud), then the same words in Tanglish (Tamil in English letters) for the subtitle.",
  english: "Write every line in simple, natural English.",
  telugu: "Write every line in spoken, everyday Telugu, in Telugu script.",
  hindi: "Write every line in spoken, everyday Hindi, in Devanagari.",
  hinglish: "Write every line twice, separated by ' | ': first in spoken everyday Hindi in Devanagari (this is read aloud), then the same words in Hinglish (Hindi in English letters) for the subtitle.",
};

export interface ScriptAsk {
  topic: string;
  language: string;
  tone: string;
  lines: number;
  names: string[];
  backgrounds: string[];
}

/** A script in our format, written by Gemini from a topic. */
export function writeScript(key: string, model: string, ask: ScriptAsk): Promise<string> {
  return write(key, model, [
    `Write a short ${ask.tone} cartoon dialogue for a vertical video about: ${ask.topic}`,
    `Use exactly these character names and no others: ${ask.names.join(", ")}. Give each a turn; keep it a real back-and-forth.`,
    `About ${ask.lines} lines. Each line short (under 14 words) and easy to say aloud. The last line is the punch line or the takeaway — set it up, don't explain it.`,
    LANGUAGE_RULES[ask.language] ?? LANGUAGE_RULES.english,
    "Format, one line each, nothing else:",
    "Name (mood): spoken words",
    "Mood is one of: normal, happy, sad, shocked, angry, proud, deadpan, sleepy. Names and moods stay in English.",
    `Start with one line that picks the place: [bg: X] where X is one of: ${ask.backgrounds.join(", ")}.`,
    "No title, no stage directions, no narration, no markdown, no quotes around lines. Keep it clean and family-friendly.",
  ].join("\n"), false);
}

export interface VideoMeta {
  title: string;
  description: string;
  tags: string[];
}

/** A YouTube title, description and tags for a script. */
export async function writeMeta(key: string, model: string, script: string, language: string): Promise<VideoMeta> {
  const text = await write(key, model, [
    "Here is the script of a short cartoon video:",
    script,
    "",
    `Write its YouTube Shorts metadata; the audience speaks ${language}. Return JSON: {"title": string, "description": string, "tags": string[]}.`,
    "title: a curiosity hook of 60–95 characters that never gives the last line away, ending with #shorts and one emoji.",
    "description: 4–6 short lines — the hook, a call to like / share / subscribe, and 8–10 hashtags on the last line.",
    "tags: 15–20 search phrases, lowercase, no # sign.",
  ].join("\n"), true);
  try {
    const json = JSON.parse(text) as Partial<VideoMeta>;
    return { title: String(json.title ?? ""), description: String(json.description ?? ""), tags: Array.isArray(json.tags) ? json.tags.map(String) : [] };
  } catch {
    throw new GeminiError(500, "Gemini's reply couldn't be read. Try again.");
  }
}
