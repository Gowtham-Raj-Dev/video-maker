import { findBackground } from "./backgrounds";
import { CHARACTERS } from "./characters";
import type { CastMember, LanguageId, Line, Mood, Project } from "./types";

export const MAX_LINES = 40;
export const MAX_LINE_CHARS = 320;

const MOOD_WORDS: Record<string, Mood> = {
  normal: "normal", happy: "happy", smile: "happy", santhosam: "happy", khush: "happy",
  sad: "sad", cry: "sad", sogam: "sad", udaas: "sad",
  shocked: "shocked", shock: "shocked", surprised: "shocked",
  sleep: "sleep", sleepy: "sleep", thookam: "sleep",
  proud: "proud", gethu: "proud", smug: "proud",
  deadpan: "deadpan", flat: "deadpan", bored: "deadpan",
  angry: "angry", kovam: "angry", gussa: "angry",
};

export const MOODS: Mood[] = ["normal", "happy", "sad", "shocked", "angry", "proud", "deadpan", "sleep"];

export interface Parsed {
  lines: Line[];
  /** Things the writer should know: lines cut short, an unknown background… */
  notes: string[];
}

/**
 * Reads a script:
 *
 *   [bg: classroom]
 *   Meena (happy): What she says | What the subtitle shows
 *
 * A line with no "Name:" belongs to whoever spoke last.
 */
export function parseScript(text: string): Parsed {
  const lines: Line[] = [];
  const notes: string[] = [];
  let bg: string | undefined;
  let pause = 0;
  let last = "";
  const rows = text.split(/\r?\n/);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index].trim();
    if (!row || row.startsWith("#") || row.startsWith("//")) continue;
    const wait = PAUSE_RE.exec(row);
    if (wait) {
      pause = Math.min(10, pause + Number(wait[1]));
      continue;
    }
    const directive = /^\[\s*(?:bg|background|scene)\s*[:=]\s*(.+?)\s*\]$/i.exec(row);
    if (directive) {
      const found = findBackground(directive[1]);
      if (found) bg = found.id;
      else notes.push(`Background "${directive[1]}" isn't one we have — kept the current one.`);
      continue;
    }
    const m = /^([^:：|()]{1,24}?)\s*(?:\(\s*([^)]*?)\s*\))?\s*[:：]\s*(.+)$/u.exec(row);
    let speaker = last || "Narrator";
    let mood: Mood | undefined;
    let body = row;
    if (m) {
      speaker = m[1].trim();
      body = m[3];
      if (m[2]) {
        mood = MOOD_WORDS[m[2].toLowerCase()];
        if (!mood) notes.push(`Mood "${m[2]}" isn't known — try ${MOODS.join(", ")}.`);
      }
    }
    const [spoken, shown] = body.split("|").map((x) => x.trim());
    if (!spoken) continue;
    if (lines.length >= MAX_LINES) {
      notes.push(`Only the first ${MAX_LINES} lines are used.`);
      break;
    }
    let textOut = spoken;
    if (textOut.length > MAX_LINE_CHARS) {
      textOut = textOut.slice(0, MAX_LINE_CHARS);
      notes.push(`${speaker}'s line was cut to ${MAX_LINE_CHARS} letters — split long lines in two.`);
    }
    lines.push({ speaker, text: textOut, caption: shown || textOut, mood, bg, row: index, ...(pause ? { pause } : {}) });
    bg = undefined;
    pause = 0;
    last = speaker;
  }
  return { lines, notes };
}

type Writing = "tamil" | "devanagari" | "telugu" | "latin" | "none";

/** The letters most of a text is written in. */
function writingOf(text: string): Writing {
  const count = { tamil: 0, devanagari: 0, telugu: 0, latin: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0b80 && c <= 0x0bff) count.tamil++;
    else if (c >= 0x0900 && c <= 0x097f) count.devanagari++;
    else if (c >= 0x0c00 && c <= 0x0c7f) count.telugu++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) count.latin++;
  }
  const best = (Object.entries(count) as Array<[Writing, number]>).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : "none";
}

const VOICE_WRITING: Record<LanguageId, Writing> = { tamil: "tamil", tanglish: "tamil", english: "latin", telugu: "telugu", hindi: "devanagari", hinglish: "devanagari" };

/**
 * Lines whose words don't match the chosen language: the voice reads what is written, so a
 * Tamil video needs Tamil letters (a Tanglish line spoken by the voice sounds like broken English),
 * and an English video needs English. For Tanglish / Hinglish the subtitle should be in English letters.
 */
export function languageProblems(lines: Line[], language: LanguageId): Array<{ index: number; why: string }> {
  const want = VOICE_WRITING[language];
  const name = LANGUAGES.find((l) => l.id === language)?.name ?? language;
  const problems: Array<{ index: number; why: string }> = [];
  lines.forEach((l, index) => {
    const spoken = writingOf(l.text);
    if (spoken !== "none" && spoken !== want) {
      problems.push({ index, why: want === "latin" ? `not in English` : `spoken words aren't in ${name === "Tanglish" ? "Tamil" : name === "Hinglish" ? "Hindi" : name} letters` });
      return;
    }
    if ((language === "tanglish" || language === "hinglish") && l.caption === l.text) problems.push({ index, why: "no English-letters subtitle after |" });
  });
  return problems;
}

const PAUSE_RE =/^\[\s*(?:pause|wait|gap)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*s?\s*\]$/i;

// ─── Editing one line from the timeline: the script text stays the one source ────

export interface LinePatch {
  speaker?: string;
  mood?: Mood | "";
  text?: string;
  caption?: string;
  pause?: number;
}

/** A line as the script writes it: "Name (mood): spoken | subtitle". */
export function formatLine(l: { speaker: string; mood?: Mood | ""; text: string; caption?: string }): string {
  const mood = l.mood && l.mood !== "normal" ? ` (${l.mood === "sleep" ? "sleepy" : l.mood})` : "";
  const shown = l.caption?.trim() && l.caption.trim() !== l.text.trim() ? ` | ${l.caption.trim()}` : "";
  return `${l.speaker.trim() || "Narrator"}${mood}: ${l.text.replace(/\s*\n\s*/g, " ").trim()}${shown}`;
}

/** The rows that belong to line `i`: from just after the line before it, to the line itself. */
function blockOf(rows: string[], lines: Line[], i: number): [number, number] {
  const from = i === 0 ? 0 : (lines[i - 1].row ?? 0) + 1;
  return [from, lines[i].row ?? from];
}

/** Changes line `i` of the script (words, who, mood, the pause before it). */
export function updateLine(script: string, i: number, patch: LinePatch): string {
  const rows = script.split(/\r?\n/);
  const lines = parseScript(script).lines;
  const line = lines[i];
  if (!line || line.row === undefined) return script;
  const text = patch.text ?? line.text;
  rows[line.row] = formatLine({
    speaker: patch.speaker ?? line.speaker,
    mood: patch.mood !== undefined ? patch.mood : line.mood,
    text: text.trim() ? text : line.text,
    caption: patch.caption !== undefined ? patch.caption : line.caption === line.text ? "" : line.caption,
  });
  if (patch.pause !== undefined) {
    const [from, to] = blockOf(rows, lines, i);
    const kept = rows.slice(from, to).filter((r) => !PAUSE_RE.test(r.trim()));
    const pause = Math.round(Math.max(0, Math.min(10, patch.pause)) * 10) / 10;
    rows.splice(from, to - from, ...kept, ...(pause > 0 ? [`[pause: ${pause}]`] : []));
  }
  return rows.join("\n");
}

/** Moves line `i` one place earlier (-1) or later (+1), with its scene and pause. */
export function moveLine(script: string, i: number, dir: -1 | 1): string {
  const lines = parseScript(script).lines;
  const j = i + dir;
  if (!lines[i] || !lines[j]) return script;
  const rows = script.split(/\r?\n/);
  const [a, b] = dir < 0 ? [j, i] : [i, j];
  const [aFrom, aTo] = blockOf(rows, lines, a);
  const [bFrom, bTo] = blockOf(rows, lines, b);
  const first = rows.slice(aFrom, aTo + 1);
  const second = rows.slice(bFrom, bTo + 1);
  rows.splice(aFrom, bTo + 1 - aFrom, ...second, ...first);
  return rows.join("\n");
}

/** Removes line `i` (a scene change written above it stays, for the next line). */
export function deleteLine(script: string, i: number): string {
  const lines = parseScript(script).lines;
  const line = lines[i];
  if (!line || line.row === undefined) return script;
  const rows = script.split(/\r?\n/);
  const [from, to] = blockOf(rows, lines, i);
  const kept = rows.slice(from, to).filter((r) => !PAUSE_RE.test(r.trim()));
  rows.splice(from, to + 1 - from, ...kept);
  return rows.join("\n");
}

/** A copy of line `i` right after it. */
export function duplicateLine(script: string, i: number): string {
  const line = parseScript(script).lines[i];
  if (!line || line.row === undefined) return script;
  const rows = script.split(/\r?\n/);
  rows.splice(line.row + 1, 0, rows[line.row]);
  return rows.join("\n");
}

/** Labels other AIs put around a script that aren't anyone speaking. */
const NOT_A_SPEAKER = /^(video\s+)?(title|tone|topic|characters?|cast|setting|location|scene description|description|notes?|caption|hashtags?|tags|duration|language|format|script|dialogue|dialog|output|summary|moral)$/i;
const CHATTER = /^(here('s| is| are)|sure|okay|ok[,!. ]|of course|certainly|absolutely|great|hope|let me know|feel free|enjoy|would you like|i('ve| have| hope))/i;

/** One spoken part: no surrounding quotes, no "(laughs)" or "*sighs*" stage directions. */
function cleanSpeech(text: string): string {
  return text
    .split("|")
    .map((part) =>
      part
        .replace(/\*[^*]{1,40}\*/g, " ")
        .replace(/^\s*[([][^)\]]{1,40}[)\]]\s*/, "")
        .trim()
        .replace(/^["“”'‘’«]+|["“”'‘’»]+$/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" | ");
}

/**
 * Turns a reply copied from ChatGPT, Claude, Gemini or any other AI into our script format:
 * drops the chatter around it, markdown, numbering, quotes and stage directions, and keeps
 * "[bg: …]" lines and moods we know. A "Title:" line becomes the video title.
 */
export function cleanPastedScript(text: string): { script: string; title: string } {
  let title = "";
  const out: string[] = [];
  // A line with no name only carries on a speech directly above it (no blank line between).
  let follows = false;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    let row = raw.trim();
    const carriesOn = follows;
    follows = false;
    if (!row || /^```/.test(row) || /^([-*_=]\s*){3,}$/.test(row)) continue;
    row = row
      .replace(/^>\s*/, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^(?:[-*•–]\s+|\d{1,3}[.)]\s+)/, "")
      .replace(/\*\*|__/g, "")
      .trim();
    if (!row) continue;

    const place = /^\[\s*(?:bg|background|scene|location|place|setting)\s*[:=\-–]\s*(.+?)\s*\]$/i.exec(row);
    if (place) {
      out.push(`[bg: ${place[1]}]`);
      continue;
    }
    if (PAUSE_RE.test(row)) {
      out.push(row);
      continue;
    }
    // "(Meena enters)", "[Music plays]": stage directions, not words.
    if (/^[[(].*[\])]$/.test(row) || /^\*[^*]+\*$/.test(row)) continue;

    const m = /^([^:：|()[\]]{1,24}?)\s*(?:[([]\s*([^)\]]*?)\s*[)\]])?\s*[:：]\s*(.*)$/u.exec(row);
    if (m) {
      const name = m[1].trim().replace(/^["'*_]+|["'*_]+$/g, "");
      const body = m[3].trim();
      if (NOT_A_SPEAKER.test(name)) {
        if (/title$/i.test(name) && body && !title) title = body.replace(/^["“'‘]+|["”'’]+$/g, "").slice(0, 80);
        continue;
      }
      if (/^(scene|act|part|take|line)\s*\d*$/i.test(name) || !body) continue;
      const mood = m[2] ? MOOD_WORDS[m[2].toLowerCase()] : undefined;
      const speech = cleanSpeech(body);
      if (speech) {
        out.push(`${name}${mood ? ` (${mood === "sleep" ? "sleepy" : mood})` : ""}: ${speech}`);
        follows = true;
      }
      continue;
    }
    // Words with no name: the AI's own chatter around the script, or a speech that carries on.
    if (!carriesOn || CHATTER.test(row) || /[:：]$/.test(row)) continue;
    const speech = cleanSpeech(row);
    if (speech) {
      out.push(speech);
      follows = true;
    }
  }
  return { script: out.join("\n"), title };
}

/** The cast for a script: keeps who was already chosen, seats new names on the characters still free. */
export function syncCast(lines: Line[], cast: CastMember[]): CastMember[] {
  const names = [...new Set(lines.map((l) => l.speaker))];
  const kept = names.map((name) => cast.find((c) => c.name.toLowerCase() === name.toLowerCase()));
  const taken = new Set(kept.filter(Boolean).map((c) => c!.characterId));
  // First every name that is a character's own ("Machan", "Rico Meena"), so a stranger can't take it; then the rest.
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  const chosen = names.map((name, i) => {
    if (kept[i]) return kept[i]!.characterId;
    const own = CHARACTERS.find((c) => !taken.has(c.id) && (c.id === slug(name) || c.name.toLowerCase() === name.trim().toLowerCase()));
    if (own) taken.add(own.id);
    return own?.id ?? null;
  });
  return names.map((name, i) => {
    const existing = kept[i];
    if (existing) return { ...existing, name };
    let id = chosen[i];
    if (!id) {
      id = (CHARACTERS.find((c) => !taken.has(c.id)) ?? CHARACTERS[i % CHARACTERS.length]).id;
      taken.add(id);
    }
    const pick = CHARACTERS.find((c) => c.id === id)!;
    return { name, characterId: pick.id, voice: pick.voice };
  });
}

export const LANGUAGES: Array<{ id: LanguageId; name: string; native: string; hint: string }> = [
  { id: "tamil", name: "Tamil", native: "தமிழ்", hint: "Tamil script for both the voice and the subtitles." },
  { id: "tanglish", name: "Tanglish", native: "Tamil + English letters", hint: "Voice in Tamil script, subtitles in English letters: write  Tamil | Tanglish." },
  { id: "english", name: "English", native: "English", hint: "Plain English." },
  { id: "telugu", name: "Telugu", native: "తెలుగు", hint: "Telugu script for both the voice and the subtitles." },
  { id: "hindi", name: "Hindi", native: "हिन्दी", hint: "Devanagari for both the voice and the subtitles." },
  { id: "hinglish", name: "Hinglish", native: "Hindi + English letters", hint: "Voice in Devanagari, subtitles in English letters: write  Hindi | Hinglish." },
];

export const SAMPLES: Record<LanguageId, { title: string; script: string }> = {
  english: {
    title: "Teacher's favourite student… but why? 😴",
    script: `[bg: room]
Meena (happy): Mom, my teacher says I'm her favourite student!
Amma: Really? Why?
Meena (proud): Because I never disturb the class.
Amma (happy): Aww, that's so good!
Meena: Yeah, I sleep through all of it!`,
  },
  tamil: {
    title: "டீச்சரோட ஃபேவரிட் ஸ்டூடன்ட்… ஏன் தெரியுமா? 😴",
    script: `[bg: room]
Meena (happy): அம்மா, நான்தான் டீச்சரோட ஃபேவரிட் ஸ்டூடன்ட்!
Amma: அப்படியா? ஏன்?
Meena (proud): நான் கிளாஸ்ல யாரையும் தொந்தரவு பண்ண மாட்டேன்.
Amma (happy): அடடா, நல்ல பொண்ணு!
Meena: ஆமா, நான் முழு கிளாஸும் தூங்கிடுவேன்!`,
  },
  tanglish: {
    title: "Teacher-oda favourite student… yen theriyuma? 😴",
    script: `[bg: room]
Meena (happy): அம்மா, நான்தான் டீச்சரோட ஃபேவரிட் ஸ்டூடன்ட்! | Amma, naan thaan teacher-oda favourite student!
Amma: அப்படியா? ஏன்? | Appadiya? Yen?
Meena (proud): நான் கிளாஸ்ல யாரையும் தொந்தரவு பண்ண மாட்டேன். | Naan class-la yaaraiyum disturb panna maatten.
Amma (happy): அடடா, நல்ல பொண்ணு! | Adada, nalla ponnu!
Meena: ஆமா, நான் முழு கிளாஸும் தூங்கிடுவேன்! | Aama, naan muzhu class-um thoongiduven!`,
  },
  telugu: {
    title: "టీచర్ ఫేవరెట్ స్టూడెంట్… ఎందుకో తెలుసా? 😴",
    script: `[bg: room]
Meena (happy): అమ్మా, నేనే టీచర్ ఫేవరెట్ స్టూడెంట్‌ని!
Amma: అవునా? ఎందుకు?
Meena (proud): ఎందుకంటే నేను క్లాస్‌లో ఎవరినీ డిస్టర్బ్ చేయను.
Amma (happy): అబ్బా, ఎంత మంచి పిల్ల!
Meena: అవును, క్లాస్ అంతా నిద్రపోతాను!`,
  },
  hindi: {
    title: "टीचर की फेवरेट स्टूडेंट… पर क्यों? 😴",
    script: `[bg: room]
Meena (happy): मम्मी, मैं टीचर की फेवरेट स्टूडेंट हूँ!
Amma: अच्छा? क्यों?
Meena (proud): क्योंकि मैं क्लास में किसी को डिस्टर्ब नहीं करती।
Amma (happy): वाह, कितनी अच्छी बच्ची है!
Meena: हाँ, मैं पूरी क्लास में सोती रहती हूँ!`,
  },
  hinglish: {
    title: "Teacher ki favourite student… par kyun? 😴",
    script: `[bg: room]
Meena (happy): मम्मी, मैं टीचर की फेवरेट स्टूडेंट हूँ! | Mummy, main teacher ki favourite student hoon!
Amma: अच्छा? क्यों? | Achha? Kyun?
Meena (proud): क्योंकि मैं क्लास में किसी को डिस्टर्ब नहीं करती। | Kyunki main class mein kisi ko disturb nahi karti.
Amma (happy): वाह, कितनी अच्छी बच्ची है! | Wah, kitni achhi bachchi hai!
Meena: हाँ, मैं पूरी क्लास में सोती रहती हूँ! | Haan, main poori class mein soti rehti hoon!`,
  },
};

export function defaultProject(language: LanguageId = "tanglish"): Project {
  const sample = SAMPLES[language];
  return {
    mode: "characters",
    plainColor: "#111111",
    script: sample.script,
    cast: syncCast(parseScript(sample.script).lines, []),
    language,
    format: "9:16",
    background: "room",
    subtitleStyle: "pop",
    subtitlePosition: "top",
    subtitleSize: 1,
    showNames: true,
    title: sample.title,
    handle: "",
    music: "funny",
    musicVolume: 0.5,
    sfx: true,
    punch: true,
    voiceMode: "batch",
    highlight: "#FFD166",
    upper: false,
    camera: "calm",
    charScale: 1,
    lineGap: 0.22,
    progressBar: false,
    endCard: "",
    musicStart: 0,
    duck: true,
    videoVolume: 0.5,
    videoStart: 0,
  };
}
