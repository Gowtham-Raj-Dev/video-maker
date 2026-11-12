/**
 * Everything that talks to Google's Gemini API — straight from the browser,
 * with the visitor's own key. Nothing goes through a server of ours.
 */

const API = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface ApiError {
  error?: { status?: string; message?: string };
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
  if (!res.ok) throw new GeminiError(res.status, explain(res.status, json));
  return json;
}

/** Runs `job` with each key in turn: when one's limit is used up, the next one takes over. */
export async function withKeys<T>(keys: string[], job: (key: string) => Promise<T>): Promise<T> {
  if (!keys.length) throw new GeminiError(401, "Add your Gemini API key first.");
  let last: unknown;
  for (const key of keys) {
    try {
      return await job(key);
    } catch (error) {
      last = error;
      if (!(error instanceof GeminiError) || (error.status !== 429 && error.status !== 403 && error.status !== 400)) throw error;
    }
  }
  throw last;
}

export const splitKeys = (text: string) => text.split(/[\s,;]+/).map((k) => k.trim()).filter(Boolean);

interface ModelInfo {
  name: string;
  supportedGenerationMethods?: string[];
}

const modelCache = new Map<string, ModelInfo[]>();

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

/** Checks a key works; the number of models it can use. */
export async function checkKey(key: string): Promise<number> {
  modelCache.delete(key);
  return (await listModels(key)).length;
}

const version = (name: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
const short = (name: string) => name.replace(/^models\//, "");

/** The newest speech model this key can use, flash before pro (flash has the free limit). */
async function findTtsModel(key: string): Promise<string | null> {
  const tts = (await listModels(key)).filter((m) => /tts/i.test(m.name));
  tts.sort((a, b) => Number(/flash/.test(b.name)) - Number(/flash/.test(a.name)) || version(b.name) - version(a.name));
  return tts.length ? short(tts[0].name) : null;
}

/** The newest plain flash text model this key can use. */
async function findTextModel(key: string): Promise<string> {
  const usable = (await listModels(key)).filter(
    (m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name) && !/tts|image|live|embedding|audio|vision|robotics|computer/i.test(m.name),
  );
  const flash = usable.filter((m) => /flash/.test(m.name));
  const pool = flash.length ? flash : usable;
  // Stable, full-size models before previews and "lite" ones; then the newest.
  const rough = (name: string) => Number(/lite|preview|exp/i.test(name));
  pool.sort((a, b) => rough(a.name) - rough(b.name) || version(b.name) - version(a.name));
  if (!pool.length) throw new GeminiError(404, "This key has no Gemini text model to write with.");
  return short(pool[0].name);
}

export interface Pcm {
  samples: Float32Array;
  rate: number;
}

interface Turn {
  speaker: string;
  text: string;
}

let ttsModel = DEFAULT_TTS_MODEL;

/**
 * One recording of a run of lines: one or two speakers (Gemini's limit), each
 * with their voice. Two speakers in one request sound like a real conversation.
 */
export async function speak(key: string, turns: Turn[], voices: Record<string, string>): Promise<Pcm> {
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
  let json: Reply;
  try {
    json = await call<Reply>(key, `models/${ttsModel}:generateContent`, body);
  } catch (error) {
    // The model named here has been retired: use the newest speech model the key has.
    if (!(error instanceof GeminiError) || error.status !== 404) throw error;
    const found = await findTtsModel(key);
    if (!found || found === ttsModel) throw new GeminiError(404, "This key has no Gemini speech (TTS) model.");
    ttsModel = found;
    json = await call<Reply>(key, `models/${ttsModel}:generateContent`, body);
  }
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline) throw new GeminiError(500, "Gemini returned no voice for this line. Try again, or reword it.");
  const bytes = Uint8Array.from(atob(inline.data), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const wav = bytes.length > 44 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF";
  const rate = Number(/rate=(\d+)/.exec(inline.mimeType)?.[1] ?? (wav ? view.getUint32(24, true) : 24_000));
  const from = wav ? 44 : 0;
  const samples = new Float32Array(Math.floor((bytes.length - from) / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(from + i * 2, true) / 32768;
  return { samples, rate };
}

export const ttsModelName = () => ttsModel;

async function write(key: string, prompt: string, json: boolean): Promise<string> {
  const model = await findTextModel(key);
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
export function writeScript(key: string, ask: ScriptAsk): Promise<string> {
  return write(key, [
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
export async function writeMeta(key: string, script: string, language: string): Promise<VideoMeta> {
  const text = await write(key, [
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
