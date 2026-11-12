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
  let last = "";
  for (const raw of text.split(/\r?\n/)) {
    const row = raw.trim();
    if (!row || row.startsWith("#") || row.startsWith("//")) continue;
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
    lines.push({ speaker, text: textOut, caption: shown || textOut, mood, bg });
    bg = undefined;
    last = speaker;
  }
  return { lines, notes };
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
  };
}
