"use client";

import {
  ArrowDown, ArrowLeft, ArrowUp, AudioLines, Captions, Check, ChevronRight, Clapperboard, Copy, CopyPlus, Download, ExternalLink, FileText, Film, FolderOpen, Image as ImageIcon, ImagePlus, KeyRound, Loader2, Mic, Music, Pause, Pencil, Play, Plus, RefreshCw, Save, SkipBack, SkipForward, Sparkles, Square, Trash2, Type, Upload, Users, Volume2, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { FeatureVote } from "@/components/FeatureVote";
import { Logo } from "@/components/Logo";
import { Select, type Option } from "@/components/Select";
import { usePlayer } from "@/components/usePlayer";
import { buildTimeline } from "@/engine/audio";
import { BACKGROUNDS } from "@/engine/backgrounds";
import { CHARACTERS, STYLES, VOICES, aboutCharacter, characterById } from "@/engine/characters";
import { decodeMono, loadVideo } from "@/engine/media";
import { canEncodeMp4, exportMp4, exportRecording, toSrt, type Quality } from "@/engine/export";
import { checkKey, fixScriptLanguage, keyReport, onPoolChange, scriptPrompt, speak, splitKeys, withPool, writeMeta, writeScript, type ScriptAsk, type VideoMeta } from "@/engine/gemini";
import { LANGUAGES, MOODS, SAMPLES, cleanPastedScript, defaultProject, deleteLine, duplicateLine, languageProblems, moveLine, parseScript, syncCast, updateLine, type LinePatch } from "@/engine/script";
import { clearVoices, getMedia, loadKeys, loadProject, putMedia, saveKeys, saveProject } from "@/engine/store";
import { MIX_RATE, type Assets, type Mood, type CameraStyle, type CastMember, type Format, type LanguageId, type MusicId, type Project, type SubtitlePosition, type SubtitleStyle, type Timeline, type VideoMode } from "@/engine/types";
import { cachedVoices, recordVoices, type LineVoice } from "@/engine/voice";
import { SITE } from "@/lib/site";
import { UTUBEFLOW_URL, isEmbeddedInUTubeFlow, linkToUTubeFlowParent, sendToUTubeFlow, sendToUTubeFlowParent } from "@/lib/utubeflow";

/** "line": editing one line picked on the timeline (not in the rail). */
type Tab = "script" | "cast" | "scene" | "captions" | "audio" | "key" | "export" | "line";
type Status = { phase: "idle" } | { phase: "voice" | "video" | "writing"; note: string; share: number };

const TABS: Array<{ id: Tab; name: string; title: string; desc: string; icon: ReactNode }> = [
  { id: "script", name: "Script", title: "Script", desc: "Who says what. Every line becomes a moment in the video.", icon: <FileText size={20} /> },
  { id: "cast", name: "Cast", title: "Cast & voices", desc: "A character and a voice for every name in the script.", icon: <Users size={20} /> },
  { id: "scene", name: "Scene", title: "Scene", desc: "Video shape, background, camera and the words on screen.", icon: <Clapperboard size={20} /> },
  { id: "captions", name: "Captions", title: "Captions", desc: "How the subtitles look and where they sit.", icon: <Captions size={20} /> },
  { id: "audio", name: "Audio", title: "Audio", desc: "Background music, sound effects and voice recording.", icon: <Music size={20} /> },
  { id: "key", name: "API key", title: "Gemini API key", desc: "Your free Google key gives the voices. It stays in this browser.", icon: <KeyRound size={20} /> },
  { id: "export", name: "Export", title: "Export", desc: "Make the MP4, then download it or send it to YouTube.", icon: <Download size={20} /> },
];
/** What each language means for the voice and the subtitles. */
const LANGUAGE_VOICE: Record<LanguageId, string> = {
  tamil: "Tamil voice · Tamil subtitles",
  tanglish: "Tamil voice · English-letter subtitles",
  english: "English voice · English subtitles",
  hindi: "Hindi voice · Hindi subtitles",
  hinglish: "Hindi voice · English-letter subtitles",
  telugu: "Telugu voice · Telugu subtitles",
};
const LINE_TAB ={ id: "line" as const, name: "Line", title: "Edit line", desc: "Change what is said, who says it, and when.", icon: <Pencil size={20} /> };
const MOOD_NAMES: Record<Mood, string> = { normal: "Normal", happy: "Happy", sad: "Sad", shocked: "Shocked", angry: "Angry", proud: "Proud", deadpan: "Deadpan", sleep: "Sleepy" };
const FORMATS: Array<{ id: Format; name: string }> = [{ id: "9:16", name: "9:16 Shorts" }, { id: "16:9", name: "16:9 YouTube" }, { id: "1:1", name: "1:1 Post" }];
const FORMATS_SHORT: Array<{ id: Format; name: string }> = [{ id: "9:16", name: "9:16" }, { id: "16:9", name: "16:9" }, { id: "1:1", name: "1:1" }];
const PLAIN_COLORS: Array<[string, string]> = [["#111111", "Black"], ["#0f1b2d", "Navy"], ["#1d3a2a", "Forest"], ["#3b1f4a", "Plum"], ["#f6f4ef", "Paper"], ["#ffffff", "White"], ["#ffd84d", "Yellow"]];
const SUB_STYLES: Array<{ id: SubtitleStyle; name: string }> = [{ id: "pop", name: "Pop" }, { id: "karaoke", name: "Karaoke" }, { id: "box", name: "Box" }, { id: "clean", name: "Clean" }, { id: "off", name: "Off" }];
const SUB_POSITIONS: Array<{ id: SubtitlePosition; name: string }> = [{ id: "top", name: "Top" }, { id: "middle", name: "Middle" }, { id: "bottom", name: "Bottom" }];
const CAMERAS: Array<{ id: CameraStyle; name: string }> = [{ id: "still", name: "Still" }, { id: "calm", name: "Calm" }, { id: "dynamic", name: "Follow speaker" }];
const MUSIC: Array<Option<MusicId>> = [
  { value: "smooth", label: "Smooth", hint: "Soft piano, warm pads" }, { value: "funny", label: "Funny tiptoe", hint: "Bouncy pizzicato" }, { value: "chill", label: "Chill", hint: "Soft chords" }, { value: "suspense", label: "Suspense", hint: "Low drone, ticking" },
  { value: "custom", label: "Your own track", hint: "Upload an audio file" }, { value: "none", label: "No music" },
];
const QUALITIES: Array<Option<Quality>> = [
  { value: 720, label: "720p", hint: "Fastest, small file" }, { value: 1080, label: "1080p Full HD", hint: "Best for Shorts & Reels" }, { value: 1440, label: "1440p", hint: "Sharper on YouTube" }, { value: 2160, label: "4K", hint: "Largest, slowest" },
];
const TONES: Array<Option<string>> = ["funny", "emotional", "motivational", "educational", "spooky-funny", "romantic comedy", "sarcastic"].map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }));
const HIGHLIGHTS = ["#FFD166", "#80ED99", "#5CC8FF", "#FF8FAB", "#FF6B6B", "#C9B6FF", "#FFFFFF"];
const SPEAKER_COLORS = ["#FF8A5B", "#5BB8A6", "#F2C14E", "#8FA8F0", "#E989B3", "#9CC56B", "#C59BE0", "#6FC2E0"];
const EMPTY_ASSETS: Assets = { bgImage: null, bgSize: [1, 1], music: null, bgVideo: null, videoAudio: null };
/** Own files bigger than this aren't kept for the next visit (they still work now). */
const KEEP_LIMIT = 300 * 1_048_576;

/** Other AIs to write the script with: the prompt is copied first, and these open it ready to paste (ChatGPT and Claude even fill it in). */
const OTHER_AIS: Array<{ name: string; url: (prompt: string) => string }> = [
  { name: "ChatGPT", url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { name: "Claude", url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { name: "Gemini", url: () => "https://gemini.google.com/app" },
];

/** Copies text; inside a frame without clipboard access, falls back to the old select-and-copy. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = Object.assign(document.createElement("textarea"), { value: text });
    area.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="lbl">{label}</span>
      {children}
      {hint && <p className="hint" style={{ marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

function Seg<T extends string | number>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: Array<{ id: T; name: string }>; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((i) => (
        <button key={String(i.id)} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)}>{i.name}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="switch">
      <span>{children}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** The timeline: a time ruler, then one track each for the voices, the scenes and the music. Drag anywhere to scrub. */
function Tracks({ timeline, time, onSeek, project, colorOf, characters, selected, onSelect, onOpen, videoName }: {
  timeline: Timeline; time: number; onSeek: (t: number) => void; project: Project; colorOf: (name: string) => string; characters: boolean;
  /** The line being edited, and what picking a clip or a bar does. */
  selected: number | null; onSelect: (i: number) => void; onOpen: (tab: "scene" | "audio") => void; videoName: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const d = Math.max(timeline.duration, 0.01);
  const pct = (t: number) => `${(Math.max(0, Math.min(d, t)) / d) * 100}%`;
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => d / s <= 10) ?? 120;
  const ticks: number[] = [];
  for (let t = 0; t <= d + 1e-6; t += step) ticks.push(t);
  const minor: number[] = [];
  for (let t = 0; t <= d + 1e-6; t += step / 2) minor.push(t);

  // Scenes: the chosen background, changed by "[bg: …]" lines (characters mode only).
  const sceneName = (id: string) => (id === "plain" ? "Plain colour" : id === "custom" ? "Your picture" : id === "video" ? `Your video${videoName ? ` · ${videoName}` : ""}` : BACKGROUNDS.find((b) => b.id === id)?.name ?? id);
  const sceneSwatch = (id: string) => {
    if (id === "plain") return project.plainColor;
    if (id === "video") return "repeating-linear-gradient(90deg, #16151a 0 3px, #555 3px 5px)";
    const b = BACKGROUNDS.find((x) => x.id === id);
    return b ? `linear-gradient(${b.swatch[0]} 0 60%, ${b.swatch[1]} 60%)` : "var(--surface-3)";
  };
  const scenes: Array<{ id: string; start: number; end: number }> = [];
  let curBg = project.background;
  let from = 0;
  if (characters && project.background !== "video" && project.background !== "custom") {
    timeline.spans.forEach((s, i) => {
      if (!s.line.bg || s.line.bg === curBg) return;
      if (i > 0) {
        scenes.push({ id: curBg, start: from, end: s.start - 0.2 });
        from = s.start - 0.2;
      }
      curBg = s.line.bg;
    });
  }
  scenes.push({ id: curBg, start: from, end: d });
  const musicName = MUSIC.find((m) => m.value === project.music)?.label ?? "";

  const seekAt = (clientX: number) => {
    const r = innerRef.current?.getBoundingClientRect();
    if (r) onSeek(((clientX - r.left) / r.width) * d);
  };

  return (
    <div className="tl2">
      <div className="tl2-labels" aria-hidden="true">
        <div className="tl2-corner" />
        <div className="tl2-label"><Mic size={13} /> Voice</div>
        <div className="tl2-label tl2-sm"><ImageIcon size={13} /> Scene</div>
        <div className="tl2-label tl2-sm"><Music size={13} /> Music</div>
      </div>
      <div
        className="tl2-area"
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(d)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} of ${clock(d)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seekAt(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); onSeek(time + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(time - 1); }
        }}
      >
        <div className="tl2-inner" ref={innerRef}>
          <div className="tl2-ruler">
            {minor.map((t) => <i key={`m${t}`} style={{ left: pct(t) }} />)}
            {ticks.map((t) => <span key={t} style={{ left: pct(t) }}>{clock(t)}</span>)}
          </div>
          <div className="tl2-lane">
            {timeline.spans.map((s, i) => {
              const c = colorOf(s.line.speaker);
              const on = time >= s.start && time <= s.end;
              const pause = s.line.pause ?? 0;
              return (
                <div key={i}>
                  {pause > 0 && (
                    <div className="tl2-pause" style={{ left: pct(s.start - pause), width: pct(pause) }} title={`${pause} s pause`}>
                      <span>{pause}s</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="tl2-clip"
                    data-on={on}
                    data-sel={selected === i}
                    title={`${s.line.speaker}: ${s.line.caption} — click to edit`}
                    style={{ left: pct(s.start), width: pct(s.end - s.start), borderColor: c, background: `color-mix(in srgb, ${c} ${on || selected === i ? 38 : 22}%, var(--surface))` }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      onSelect(i);
                      onSeek(s.start + 0.01);
                    }}
                  >
                    <b>{s.line.speaker}</b>
                    <span>{s.line.caption}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="tl2-lane tl2-sm">
            {scenes.map((s, i) => (
              <button type="button" key={i} className="tl2-bar" style={{ left: pct(s.start), width: pct(s.end - s.start) }} onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpen("scene")} title="Change the scene">
                <i style={{ background: sceneSwatch(s.id) }} />
                <span>{sceneName(s.id)}</span>
              </button>
            ))}
          </div>
          <div className="tl2-lane tl2-sm">
            {project.music === "none" ? (
              <button type="button" className="tl2-empty" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpen("audio")}>No music · add</button>
            ) : (
              <button type="button" className="tl2-bar tl2-music" style={{ left: 0, width: "100%", opacity: 0.45 + project.musicVolume * 0.55 }} onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpen("audio")} title="Change the music">
                <span>{musicName}{project.duck ? " · quieter under voices" : ""}{timeline.silent ? " · plays once voices are recorded" : ""}</span>
              </button>
            )}
          </div>
          <div className="tl2-head" style={{ left: pct(time) }}><b /></div>
        </div>
      </div>
    </div>
  );
}

export function Editor() {
  const [project, setProject] = useState<Project>(() => defaultProject());
  // Shown inside UTubeFlow's "Video Maker" page: no way out to our home page, videos go to its Ready to Post.
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    if (!isEmbeddedInUTubeFlow()) return;
    setEmbedded(true);
    // The frame never scrolls as a page (only the panels inside do), so UTubeFlow's page can't be dragged along.
    document.documentElement.classList.add("vm-embed");
    const unlink = linkToUTubeFlowParent();
    return () => {
      unlink();
      document.documentElement.classList.remove("vm-embed");
    };
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("script");
  const [keysText, setKeysText] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<{ ok: boolean; text: string } | null>(null);
  const [newKey, setNewKey] = useState("");
  // Redraw the key list whenever a key's state changes (used up, refused, back).
  const [, setPoolTick] = useState(0);
  useEffect(() => onPoolChange(() => setPoolTick((n) => n + 1)), []);
  const [voiced, setVoiced] = useState<{ sig: string; voices: LineVoice[] } | null>(null);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [error, setError] = useState("");
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string; sig: string; silent: boolean } | null>(null);
  const [quality, setQuality] = useState<Quality>(1080);
  const [fps, setFps] = useState(30);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [fonts, setFonts] = useState(0);
  const [ai, setAi] = useState({
    open: false, topic: "", tone: "funny", lines: 6, people: 2, via: "gemini" as "gemini" | "paste", pasted: "",
    /** true: the AI picks who fits the story; false: the people already in the video. */
    pick: true,
    /** "write": the ask; "review": the script it wrote, to read, fix and confirm before it is used. */
    stage: "write" as "write" | "review", draft: "", draftTitle: "",
  });
  /** Gemini's script as it is being written, and what went wrong (shown inside the AI dialog). */
  const [aiLive, setAiLive] = useState("");
  const [aiError, setAiError] = useState("");
  const [copied, setCopied] = useState(false);
  const [draftEdit, setDraftEdit] = useState(false);
  /** Bumped to record the voices and play right after a new script is in. */
  const [voiceKick, setVoiceKick] = useState(0);
  const aiTopicRef = useRef<HTMLTextAreaElement>(null);
  const [assets, setAssets] = useState<Assets>(EMPTY_ASSETS);
  const [assetNames, setAssetNames] = useState({ bg: "", music: "", video: "" });
  const [loadingMedia, setLoadingMedia] = useState("");
  /** The line picked on the timeline, edited in the "line" panel. */
  const [selected, setSelected] = useState<number | null>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState("");
  /** The visitor chose to watch without a voice: stop covering the stage. */
  const [draftOk, setDraftOk] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const musicFileRef = useRef<HTMLInputElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const sampleRef = useRef<AudioContext | null>(null);

  // What was saved in this browser.
  useEffect(() => {
    setProject(loadProject());
    setKeysText(loadKeys());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) saveProject(project);
  }, [project, loaded]);

  // The canvas can only write with fonts that have arrived: redraw as each script's face loads.
  useEffect(() => {
    const faces: Array<[string, string]> = [["Baloo 2", "Aa"], ["Baloo 2", "अ"], ["Baloo Thambi 2", "அ"], ["Baloo Tammudu 2", "అ"]];
    for (const [family, text] of faces) void document.fonts.load(`800 40px "${family}"`, text).then(() => setFonts((n) => n + 1)).catch(() => {});
  }, []);

  const parsed = useMemo(() => parseScript(project.script), [project.script]);
  const sig = useMemo(() => JSON.stringify([parsed.lines.map((l) => [l.speaker, l.text]), project.cast.map((c) => [c.name, c.voice])]), [parsed, project.cast]);
  const voices = voiced?.sig === sig ? voiced.voices : null;
  const timeline = useMemo(
    () => buildTimeline(parsed.lines, project, voices, assets.music, assets.videoAudio),
    // Only what changes the timing or the sound; looks are read at draw time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, voices, project.music, project.musicVolume, project.sfx, project.punch, project.lineGap, project.musicStart, project.duck, project.background, project.videoVolume, project.videoStart, assets.music, assets.videoAudio],
  );
  const projectSig = useMemo(() => JSON.stringify(project), [project]);
  const player = usePlayer(project, timeline, assets, fonts);
  const busy = status.phase !== "idle";
  const keys = splitKeys(keysText);
  const language = LANGUAGES.find((l) => l.id === project.language)!;
  const speakerColor = (name: string) => SPEAKER_COLORS[Math.max(0, project.cast.findIndex((c) => c.name === name)) % SPEAKER_COLORS.length];

  const set = <K extends keyof Project>(key: K, value: Project[K]) => setProject((p) => ({ ...p, [key]: value }));
  const setScript = (script: string) => setProject((p) => ({ ...p, script, cast: syncCast(parseScript(script).lines, p.cast) }));
  const setMember = (name: string, patch: Partial<CastMember>) => set("cast", project.cast.map((c) => (c.name === name ? { ...c, ...patch } : c)));

  const characters = project.mode !== "captions";
  /** Switching mode also picks the look that suits it; everything stays editable after. */
  const setMode = (mode: VideoMode) =>
    setProject((p) => {
      if ((p.mode ?? "characters") === mode) return p;
      return mode === "captions"
        ? { ...p, mode, background: "plain", subtitlePosition: "middle", music: p.music === "funny" ? "smooth" : p.music }
        : { ...p, mode, background: p.background === "plain" ? "room" : p.background, subtitlePosition: "top", music: p.music === "smooth" ? "funny" : p.music };
    });

  const currentIndex = timeline.spans.reduce((found, s, i) => (player.time >= s.start - 0.2 ? i : found), -1);
  const currentSpan = currentIndex >= 0 ? timeline.spans[currentIndex] : null;
  const jump = (dir: 1 | -1) => {
    const spans = timeline.spans;
    if (!spans.length) return;
    const target = dir > 0 ? spans.find((s) => s.start > player.time + 0.05) : [...spans].reverse().find((s) => s.start < player.time - 0.4);
    player.seek(target ? target.start + 0.02 : dir > 0 ? timeline.duration : 0);
  };

  // Space plays and pauses (when not typing).
  const toggleRef = useRef(() => {});
  toggleRef.current = () => (player.playing ? player.stop() : player.play());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName) || el.closest("[role=listbox],[role=dialog]"))) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc closes the AI dialog.
  const closeAiRef = useRef(() => {});
  useEffect(() => {
    if (!ai.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAiRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ai.open]);

  const needKey = () => {
    setError("Add your free Gemini API key first — it is what gives the characters their voices.");
    setTab("key");
  };

  /** Records every line's voice (or reuses what is already recorded). */
  async function makeVoices(fresh: boolean, signal: AbortSignal): Promise<LineVoice[]> {
    if (voices && !fresh) return voices;
    setStatus({ phase: "voice", note: "Recording voices…", share: 0 });
    const recorded = await recordVoices(parsed.lines, project.cast, keys, project.voiceMode === "line", fresh, (p) => setStatus({ phase: "voice", note: p.note || "Recording voices…", share: p.done / p.total }), signal);
    setVoiced({ sig, voices: recorded });
    return recorded;
  }

  async function run(job: (signal: AbortSignal) => Promise<void>) {
    setError("");
    player.stop();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await job(abort.signal);
    } catch (e) {
      if (!isAbort(e)) setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
      abortRef.current = null;
    }
  }

  // Voices recorded before (this visit or an earlier one) come back by themselves, without a request.
  useEffect(() => {
    if (!loaded || voices || busy || !parsed.lines.length) return;
    let live = true;
    const timer = window.setTimeout(() => {
      void cachedVoices(parsed.lines, project.cast).then((found) => {
        if (live && found) setVoiced({ sig, voices: found });
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded, busy]);

  // Play once the new voices are in the timeline.
  const autoPlayRef = useRef(false);
  useEffect(() => {
    if (autoPlayRef.current && !timeline.silent) {
      autoPlayRef.current = false;
      player.playFrom(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  const generateVoice = (fresh = false, thenPlay = true) => {
    if (!parsed.lines.length) return setError("Write at least one line in the script, like  Meena: Hello!");
    if (!keys.length) return needKey();
    player.prime();
    void run(async (signal) => {
      await makeVoices(fresh, signal);
      autoPlayRef.current = thenPlay;
    });
  };

  /** Play: with the voices, recording them first when there are none yet. */
  const playOrVoice = () => {
    if (player.playing) return player.stop();
    if (voices || !parsed.lines.length || busy) return player.play();
    if (!keys.length) return needKey();
    generateVoice(false, true);
  };

  async function renderVideo(full: Timeline, signal: AbortSignal) {
    setStatus({ phase: "video", note: "Drawing the video…", share: 0 });
    const onProgress = (share: number) => setStatus({ phase: "video", note: share < 0.95 ? "Drawing the video…" : "Finishing the file…", share });
    const options = { quality, fps, assets };
    let out;
    if (canEncodeMp4()) {
      try {
        out = await exportMp4(project, full, options, onProgress, signal);
      } catch (e) {
        if (isAbort(e)) throw e;
        setStatus({ phase: "video", note: "Fast export isn't available here — recording as it plays…", share: 0 });
        out = await exportRecording(project, full, options, onProgress, signal);
      }
    } else {
      setStatus({ phase: "video", note: "Recording the video as it plays (this browser has no fast export)…", share: 0 });
      out = await exportRecording(project, full, options, onProgress, signal);
    }
    setVideo((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { url: URL.createObjectURL(out.blob), blob: out.blob, ext: out.ext, sig: projectSig, silent: full.silent };
    });
  }

  const exportVideo = (silent: boolean) => {
    if (!parsed.lines.length) return setError("Write at least one line in the script first.");
    if (!silent && !voices && !keys.length) return needKey();
    setTab("export");
    void run(async (signal) => {
      const full = silent ? buildTimeline(parsed.lines, project, null, assets.music, assets.videoAudio) : buildTimeline(parsed.lines, project, await makeVoices(false, signal), assets.music, assets.videoAudio);
      await renderVideo(full, signal);
    });
  };

  /** What the AI is asked for: the topic, the language, and the names already in the video first. */
  const keepCast = !ai.pick && project.cast.length > 0;
  const aiAsk = (): ScriptAsk => {
    // One entry per name (both styles share names), described so the AI casts the story sensibly.
    const library = CHARACTERS.filter((c, i) => CHARACTERS.findIndex((x) => x.name === c.name) === i);
    const cast = keepCast
      ? project.cast.map((m) => ({ name: m.name, about: aboutCharacter(characterById(m.characterId)) }))
      : library.map((c) => ({ name: c.name, about: aboutCharacter(c) }));
    return {
      topic: ai.topic.trim() || "a funny everyday moment at home",
      language: project.language,
      tone: ai.tone,
      lines: ai.lines,
      people: keepCast ? project.cast.length : ai.people,
      cast,
      pick: !keepCast,
      backgrounds: BACKGROUNDS.slice(0, 12).map((b) => b.id),
    };
  };

  const openAi = () => {
    setAi((a) => ({ ...a, open: true, stage: "write" }));
    setAiError("");
    setCopied(false);
    requestAnimationFrame(() => aiTopicRef.current?.focus());
  };
  const closeAi = () => {
    if (status.phase === "writing") abortRef.current?.abort();
    setAi((a) => ({ ...a, open: false }));
  };
  closeAiRef.current = closeAi;

  /** Puts a new script in; with `withVoice`, records the voices and plays it straight after. */
  const applyScript = (script: string, title: string, withVoice: boolean) => {
    setScript(script);
    // A new story gets its own title: the AI's, or the idea it was written from (never the old video's).
    const fallback = ai.topic.trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 60);
    set("title", title || fallback || project.title);
    setDraftOk(false);
    setAi((a) => ({ ...a, open: false, pasted: "", stage: "write", draft: "", draftTitle: "" }));
    setSelected(null);
    setTab("script");
    if (withVoice) setVoiceKick((n) => n + 1);
  };

  // After a new script is in, voice it (this render already has the new lines).
  useEffect(() => {
    if (voiceKick) generateVoice(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceKick]);

  async function aiScript() {
    setAiError("");
    if (!ai.topic.trim()) {
      aiTopicRef.current?.focus();
      return setAiError("Tell the AI what the video is about.");
    }
    if (!keys.length) return setAiError("no-key");
    setError("");
    player.stop();
    const abort = new AbortController();
    abortRef.current = abort;
    setAiLive("");
    setStatus({ phase: "writing", note: "Gemini is writing your script…", share: 0.4 });
    try {
      const ask = aiAsk();
      const text = await withPool(keys, "text", (key, model) => writeScript(key, model, ask, { signal: abort.signal, onText: setAiLive }));
      const { script, title } = cleanPastedScript(text);
      if (!parseScript(script).lines.length) throw new Error("Gemini's reply didn't have any lines like  Name: words. Try again, or use Copy & paste.");
      // Not used yet: shown first, to read, fix and confirm.
      setAi((a) => ({ ...a, stage: "review", draft: script, draftTitle: title }));
    } catch (e) {
      if (!isAbort(e)) setAiError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
      abortRef.current = null;
      setAiLive("");
    }
  }

  const pastedScript = useMemo(() => cleanPastedScript(ai.pasted), [ai.pasted]);
  const pastedLines = useMemo(() => parseScript(pastedScript.script).lines, [pastedScript]);
  const takePasted = () => {
    if (!pastedLines.length) return setAiError("No lines found yet. Each line should look like  Meena: words");
    setAiError("");
    setAi((a) => ({ ...a, stage: "review", draft: pastedScript.script, draftTitle: pastedScript.title }));
  };

  // The script waiting for a yes: its lines, who speaks, and lines not in the chosen language.
  const draftLines = useMemo(() => parseScript(ai.draft).lines, [ai.draft]);
  const draftProblems = useMemo(() => languageProblems(draftLines, project.language), [draftLines, project.language]);
  const draftCast = useMemo(() => syncCast(draftLines, project.cast), [draftLines, project.cast]);
  /** Has Gemini put the lines that aren't in the chosen language into it. */
  async function fixDraft() {
    setAiError("");
    if (!keys.length) return setAiError("no-key");
    const abort = new AbortController();
    abortRef.current = abort;
    setAiLive("");
    setStatus({ phase: "writing", note: `Putting every line in ${language.name}…`, share: 0.4 });
    try {
      const text = await withPool(keys, "text", (key, model) => fixScriptLanguage(key, model, ai.draft, project.language, { signal: abort.signal, onText: setAiLive }));
      const { script } = cleanPastedScript(text);
      if (!parseScript(script).lines.length) throw new Error("Gemini's reply had no lines. Try again.");
      setAi((a) => ({ ...a, draft: script }));
    } catch (e) {
      if (!isAbort(e)) setAiError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
      abortRef.current = null;
      setAiLive("");
    }
  }

  const aiErrorNote =
    aiError === "no-key" ? (
      <div className="note note-info ai-nokey">
        <span>Gemini needs your free API key. No key? Use <b>Copy &amp; paste</b> — any AI can write it (the voices still need the key).</span>
        <button type="button" className="btn btn-sm" onClick={() => { closeAi(); setTab("key"); }}><KeyRound size={14} /> Add key</button>
      </div>
    ) : aiError ? (
      <p className="note note-error" role="alert">{aiError}</p>
    ) : null;

  const confirmDraft = (withVoice: boolean) => {
    if (!draftLines.length) return setAiError("The script has no lines like  Name: words");
    // Unlock sound now, while this is still the click: the voice plays after it is recorded.
    if (withVoice) player.prime();
    applyScript(ai.draft, ai.draftTitle, withVoice);
  };
  const copyPrompt = async () => {
    setAiError("");
    if (!ai.topic.trim()) {
      aiTopicRef.current?.focus();
      return setAiError("Tell the AI what the video is about first.");
    }
    const ok = await copyText(scriptPrompt(aiAsk(), true));
    setCopied(ok);
    if (!ok) setAiError("Couldn't copy here. Open “See the prompt” and copy it by hand.");
  };

  async function aiMeta() {
    setError("");
    if (!keys.length) return needKey();
    setStatus({ phase: "writing", note: "Gemini is writing the title, description and tags…", share: 0.5 });
    try {
      setMeta(await withPool(keys, "text", (key, model) => writeMeta(key, model, project.script, language.name)));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
    }
  }

  /** Checks keys (listing their models spends none of the free limit). */
  async function testKeys(list = keys) {
    if (!list.length) return setKeyState({ ok: false, text: "Add a key first." });
    setKeyState({ ok: true, text: "Checking…" });
    const results = await Promise.all(list.map((k) => checkKey(k).then(() => true, () => false)));
    const good = results.filter(Boolean).length;
    setKeyState(
      good === list.length
        ? { ok: true, text: list.length > 1 ? `All ${list.length} keys work. They are used in turn, every voice model of each.` : "This key works. Press “Generate voice” to hear your characters." }
        : { ok: good > 0, text: `${good} of ${list.length} ${list.length === 1 ? "key works" : "keys work"} — the others are skipped. See each key below.` },
    );
  }

  const setKeyList = (list: string[]) => {
    const text = list.join(", ");
    setKeysText(text);
    saveKeys(text);
  };
  const addKeys = () => {
    const fresh = splitKeys(newKey).filter((k) => !keys.includes(k));
    if (!fresh.length) return;
    setKeyList([...keys, ...fresh]);
    setNewKey("");
    void testKeys(fresh);
  };
  const removeKey = (key: string) => {
    setKeyList(keys.filter((k) => k !== key));
    setKeyState(null);
  };
  const mask = (k: string) => (k.length > 12 ? `${k.slice(0, 6)}••••••${k.slice(-4)}` : "••••••");

  /** Speaks one of the member's lines in their voice, to hear it before recording everything. */
  async function testVoice(member: CastMember) {
    setError("");
    if (!keys.length) return needKey();
    setTesting(member.name);
    try {
      const text = parsed.lines.find((l) => l.speaker === member.name)?.text ?? `Hello, I am ${member.name}.`;
      const pcm = await withPool(keys, "tts", (key, model) => speak(key, model, [{ speaker: member.name, text }], { [member.name]: member.voice }));
      const audio = (sampleRef.current ??= new AudioContext());
      await audio.resume();
      const buffer = audio.createBuffer(1, pcm.samples.length, pcm.rate);
      buffer.getChannelData(0).set(pcm.samples);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setTesting("");
    }
  }

  const insert = (text: string) => {
    setScript(`${project.script.replace(/\s+$/, "")}\n${text}`);
    setTab("script");
    requestAnimationFrame(() => {
      const el = scriptRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = el.scrollHeight;
    });
  };

  // ─── Editing one line picked on the timeline ───
  const selectLine = (i: number) => {
    setSelected(i);
    setTab("line");
  };
  const patchLine = (i: number, patch: LinePatch) => setScript(updateLine(project.script, i, patch));
  const shiftLine = (i: number, dir: -1 | 1) => {
    setScript(moveLine(project.script, i, dir));
    setSelected(i + dir);
  };
  const removeLine = (i: number) => {
    setScript(deleteLine(project.script, i));
    setSelected(parsed.lines.length > 1 ? Math.min(i, parsed.lines.length - 2) : null);
    if (parsed.lines.length <= 1) setTab("script");
  };
  const copyLine = (i: number) => {
    setScript(duplicateLine(project.script, i));
    setSelected(i + 1);
  };
  /** Plays just this line (and a moment around it). */
  const hearLine = (i: number) => {
    const span = timeline.spans[i];
    if (!span) return;
    if (!voices) return playOrVoice();
    player.playFrom(Math.max(0, span.start - 0.15));
  };
  // Past the end after a delete or a new script: let go.
  useEffect(() => {
    if (selected !== null && selected >= parsed.lines.length) setSelected(parsed.lines.length ? parsed.lines.length - 1 : null);
  }, [selected, parsed.lines.length]);

  // Own files: opened now, kept in this browser for the next visit. `restore` skips choosing them again.
  async function pickBackground(file: Blob | undefined, name = (file as File | undefined)?.name ?? "picture", restore = false) {
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      setAssets((a) => ({ ...a, bgImage: image, bgSize: [image.width, image.height] }));
      setAssetNames((n) => ({ ...n, bg: name }));
      if (!restore) {
        set("background", "custom");
        if (file.size < KEEP_LIMIT) void putMedia("picture", { name, blob: file });
      }
    } catch {
      if (!restore) setError("That picture couldn't be opened. Try a JPG or PNG.");
    }
  }

  async function pickMusic(file: Blob | undefined, name = (file as File | undefined)?.name ?? "music", restore = false) {
    if (!file) return;
    if (!restore) setLoadingMedia("Opening your music…");
    const mono = await decodeMono(file);
    setLoadingMedia("");
    if (!mono) {
      if (!restore) setError("That audio file couldn't be opened. Try an MP3, WAV or M4A.");
      return;
    }
    setAssets((a) => ({ ...a, music: mono }));
    setAssetNames((n) => ({ ...n, music: name }));
    if (!restore) {
      setProject((p) => ({ ...p, music: "custom", musicStart: 0 }));
      if (file.size < KEEP_LIMIT) void putMedia("music", { name, blob: file });
    }
  }

  async function pickVideo(file: Blob | undefined, name = (file as File | undefined)?.name ?? "video", restore = false) {
    if (!file) return;
    if (!restore) setLoadingMedia("Opening your video…");
    try {
      const [video, sound] = await Promise.all([loadVideo(file), decodeMono(file)]);
      setAssets((a) => {
        if (a.bgVideo) {
          a.bgVideo.pause();
          URL.revokeObjectURL(a.bgVideo.src);
        }
        return { ...a, bgVideo: video, videoAudio: sound };
      });
      setAssetNames((n) => ({ ...n, video: name }));
      if (!restore) {
        setProject((p) => ({ ...p, background: "video", videoStart: 0, videoVolume: sound ? p.videoVolume ?? 0.5 : 0 }));
        if (file.size < KEEP_LIMIT) void putMedia("video", { name, blob: file });
      }
    } catch (e) {
      if (!restore) setError(messageOf(e));
    } finally {
      setLoadingMedia("");
    }
  }

  const removeVideo = () => {
    setAssets((a) => {
      if (a.bgVideo) {
        a.bgVideo.pause();
        URL.revokeObjectURL(a.bgVideo.src);
      }
      return { ...a, bgVideo: null, videoAudio: null };
    });
    setAssetNames((n) => ({ ...n, video: "" }));
    void putMedia("video", null);
    setProject((p) => ({ ...p, background: p.background === "video" ? (p.mode === "captions" ? "plain" : "room") : p.background }));
  };

  // The own files from the last visit come back.
  useEffect(() => {
    void getMedia("picture").then((m) => m && pickBackground(m.blob, m.name, true));
    void getMedia("music").then((m) => m && pickMusic(m.blob, m.name, true));
    void getMedia("video").then((m) => m && pickVideo(m.blob, m.name, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openProject(file: File | undefined) {
    if (!file) return;
    try {
      const saved = JSON.parse(await file.text()) as Partial<Project>;
      if (typeof saved.script !== "string") throw new Error("not a project");
      const next = { ...defaultProject(), ...saved };
      setProject({ ...next, cast: syncCast(parseScript(next.script).lines, next.cast ?? []) });
    } catch {
      setError("That file isn't a Video Maker project.");
    }
  }

  const [flow, setFlow] = useState<{ state: "idle" | "opening" | "linked" | "done" | "error"; text: string }>({ state: "idle", text: "" });
  async function sendToFlow() {
    if (!video) return;
    setFlow({ state: "opening", text: embedded ? "Adding to Ready to Post…" : "Opening UTubeFlow… sign in there if it asks." });
    try {
      const description = meta?.description ?? project.script.split("\n").filter((l) => l.includes(":") && !l.trim().startsWith("[")).map((l) => l.replace(/\s*\([^)]*\)\s*:/, ":").split("|").pop()!.trim()).join("\n");
      const send = { blob: video.blob, fileName: `${fileName}.${video.ext}`, title: meta?.title || project.title || "Cartoon video", description, kind: project.format === "9:16" ? "short" : "video" } as const;
      const count = embedded
        ? await sendToUTubeFlowParent(send)
        : await sendToUTubeFlow(send, () => setFlow({ state: "linked", text: "Connected — sending the video…" }));
      if (embedded) setFlow({ state: "done", text: count ? "Added to Ready to Post." : "UTubeFlow got the message but no video. Try again." });
      else setFlow({ state: "done", text: count ? "Sent! It's in your UTubeFlow upload list — schedule it there." : "UTubeFlow got the message but no video. Try again." });
    } catch (e) {
      setFlow({ state: "error", text: messageOf(e) });
    }
  }

  const fileName = (project.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "cartoon-video").toLowerCase();

  const characterOptions: Array<Option<string>> = CHARACTERS.map((c) => ({ value: c.id, label: c.name, hint: c.blurb, group: STYLES.find((s) => s.id === c.style)?.name, icon: <Avatar id={c.id} size={30} /> }));
  const voiceOptions: Array<Option<string>> = VOICES.map((v) => ({ value: v.name, label: v.name, hint: v.tone, group: v.kind === "F" ? "Female voices" : "Male voices" }));
  const lineOptions: Array<Option<string>> = [
    ...project.cast.map((c) => ({ value: c.name, label: c.name, group: "In this video", icon: <Avatar id={c.characterId} size={30} /> })),
    // Both styles share names (a Classic and a Slim "Meena"): a name is offered once.
    ...CHARACTERS.filter((c, i) => !project.cast.some((m) => m.name === c.name) && CHARACTERS.findIndex((x) => x.name === c.name) === i).map((c) => ({ value: c.name, label: c.name, hint: c.blurb, group: "Add someone new", icon: <Avatar id={c.id} size={30} /> })),
  ];
  const sceneOptions: Array<Option<string>> = BACKGROUNDS.slice(0, 12).map((b) => ({
    value: b.id, label: b.name,
    icon: <span aria-hidden="true" style={{ width: 30, height: 24, borderRadius: 6, flex: "none", background: `linear-gradient(${b.swatch[0]} 0 66%, ${b.swatch[1]} 66%)` }} />,
  }));

  return (
    <div className="ed">
      <header className="ed-top">
        {embedded ? (
          <span className="ed-brand">
            <Logo size={28} />
            <span className="hidden md:inline">{SITE.name}</span>
          </span>
        ) : (
          <Link href="/" className="ed-brand" title="Back to the home page">
            <Logo size={28} />
            <span className="hidden md:inline">{SITE.name}</span>
          </Link>
        )}
        <span className="ed-divider" aria-hidden="true" />
        <div className="ed-title">
          <input aria-label="Video title (shown at the top of the video)" value={project.title} onChange={(e) => set("title", e.target.value)} placeholder="Untitled video" maxLength={80} spellCheck={false} />
          <small className="hidden md:flex"><Check size={12} /> Saved in this browser · {parsed.lines.length} lines · {clock(timeline.duration)}</small>
        </div>
        <div className="ed-top-center hidden lg:flex">
          <Seg label="Video shape" value={project.format} onChange={(v) => set("format", v)} items={FORMATS_SHORT} />
        </div>
        <span className={`pill ${voices ? "pill-ok" : "pill-warn"} hidden xl:inline-flex`}>
          {voices ? <><Volume2 size={14} /> Voice ready</> : <><Mic size={14} /> Silent draft</>}
        </span>
        <button type="button" className={`btn ${voices ? "" : "btn-teal"}`} disabled={busy} onClick={() => generateVoice(Boolean(voices))} title={voices ? "Record the voices again" : "Record the characters' voices with your Gemini key"}>
          {voices ? <RefreshCw size={16} /> : <Mic size={16} />}
          <span className="hidden sm:inline">{voices ? "Re-record voice" : "Generate voice"}</span>
          <span className="sm:hidden">Voice</span>
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => exportVideo(false)}>
          <Download size={16} /> Export
        </button>
      </header>

      <div>
        {busy && !(status.phase === "writing" && ai.open) && (
          <div className="ed-status" role="status" aria-live="polite">
            <Loader2 size={16} className="animate-spin" style={{ flex: "none" }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status.note}</span>
            <div className="bar" style={{ flex: 1, minWidth: 60 }}><i style={{ width: `${Math.round(status.share * 100)}%` }} /></div>
            <button type="button" className="btn btn-sm" onClick={() => abortRef.current?.abort()}><Square size={12} /> Stop</button>
          </div>
        )}
        {error && !busy && (
          <div className="ed-status" role="alert" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 32 }} onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}
      </div>

      <div className="ed-body">
        <nav className="rail" role="tablist" aria-label="Editor sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon}
              {t.name}
            </button>
          ))}
        </nav>

        <section className="ed-panel" role="tabpanel" aria-label={(TABS.find((t) => t.id === tab) ?? LINE_TAB).name}>
          {(() => {
            const info = TABS.find((t) => t.id === tab) ?? LINE_TAB;
            return (
              <div className="ed-panel-head">
                {tab === "line" ? (
                  <button type="button" className="btn btn-ghost btn-icon ed-back" onClick={() => { setSelected(null); setTab("script"); }} aria-label="Back to the script" title="Back to the script"><ArrowLeft size={18} /></button>
                ) : (
                  <span className="ed-panel-icon" aria-hidden="true">{info.icon}</span>
                )}
                <div>
                  <h2>{tab === "line" && selected !== null ? `Line ${selected + 1} of ${parsed.lines.length}` : info.id === "cast" && !characters ? "Voices" : info.title}</h2>
                  <p>{info.id === "cast" && !characters ? "A voice for every name in the script." : info.desc}</p>
                </div>
              </div>
            );
          })()}
          {tab === "script" && (
            <div className="grid gap-4">
              <div>
                <span className="lbl">Video type</span>
                <div className="mode-pick" role="radiogroup" aria-label="Video type">
                  {([
                    ["characters", <Users key="i" size={18} />, "With characters", "Cartoon people act it out"],
                    ["captions", <Type key="i" size={18} />, "Text only", "Plain screen, big subtitles"],
                  ] as Array<[VideoMode, ReactNode, string, string]>).map(([id, icon, name, desc]) => (
                    <button key={id} type="button" role="radio" aria-checked={(project.mode ?? "characters") === id} onClick={() => setMode(id)}>
                      <span className="mode-icon">{icon}</span>
                      <b>{name}</b>
                      <small>{desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Language" hint={language.hint}>
                <Select<LanguageId> ariaLabel="Language" value={project.language} onChange={(v) => set("language", v)} options={LANGUAGES.map((l) => ({ value: l.id, label: l.name, hint: l.native }))} />
              </Field>
              <button type="button" className="ai-cta" onClick={openAi} aria-haspopup="dialog">
                <span className="ai-cta-icon" aria-hidden="true"><Sparkles size={18} /></span>
                <span className="ai-cta-text">
                  <b>Write with AI</b>
                  <small>Gemini with your key, or paste from ChatGPT, Claude or any AI</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <div>
                <div className="script-head">
                  <label className="lbl" htmlFor="script">Dialogue</label>
                  <code>Name (mood): words</code>
                </div>
                <textarea id="script" ref={scriptRef} className="field script-area" rows={12} spellCheck={false} value={project.script} onChange={(e) => setScript(e.target.value)} placeholder={"Meena (happy): Hello!\nAmma: Hi Meena."} />
                <div className="script-foot">
                  <span>{parsed.lines.length} {parsed.lines.length === 1 ? "line" : "lines"} · about {Math.round(timeline.duration)} s</span>
                  <button type="button" className="link-btn" onClick={() => { setScript(SAMPLES[project.language].script); set("title", SAMPLES[project.language].title); }}>Load sample</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select<string> ariaLabel="Add a line for" placeholder="Add line" leading={<Plus size={16} />} search value={null} onChange={(name) => insert(`${name}: `)} options={lineOptions} />
                <Select<string> ariaLabel="Change the scene to" placeholder="Scene" leading={<Clapperboard size={16} />} value={null} onChange={(id) => insert(`[bg: ${id}]`)} options={sceneOptions} />
              </div>
              {parsed.notes.map((n) => <p key={n} className="note note-info">{n}</p>)}
              <details>
                <summary className="hint" style={{ fontWeight: 700 }}>▸ Script tricks</summary>
                <ul className="hint mt-2 grid gap-2 pl-5" style={{ listStyle: "disc" }}>
                  <li><b>Moods:</b> <code>Meena (angry): …</code> — {MOODS.join(", ")}.</li>
                  <li><b>New place</b> mid-video: a line with <code>[bg: park]</code>.</li>
                  <li><b>Subtitle different from the voice:</b> <code>Name: spoken | subtitle</code> — a Tamil voice with Tanglish subtitles.</li>
                  <li>Any name works; each new name gets a character in <b>Cast</b>. The last line is the punch line.</li>
                </ul>
              </details>
            </div>
          )}

          {tab === "line" && (() => {
            const i = selected ?? -1;
            const line = parsed.lines[i];
            const span = timeline.spans[i];
            if (!line || !span) return <p className="hint">Pick a line on the timeline to edit it.</p>;
            const spokenProblem = languageProblems([line], project.language)[0];
            return (
              <div className="grid gap-4" key={`${i}:${line.row}`}>
                <div className="li-time">
                  <span>{clock(span.start)} – {clock(span.end)}</span>
                  <span>{(span.end - span.start).toFixed(1)} s{voices ? "" : " (estimated — no voice yet)"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Who says it">
                    <Select<string> ariaLabel="Who says it" search value={line.speaker} onChange={(name) => patchLine(i, { speaker: name })} options={lineOptions} />
                  </Field>
                  <Field label="Mood">
                    <Select<string> ariaLabel="Mood" value={line.mood ?? "normal"} onChange={(m) => patchLine(i, { mood: m as Mood })} options={MOODS.map((m) => ({ value: m, label: MOOD_NAMES[m] }))} />
                  </Field>
                </div>
                <div>
                  <label className="lbl" htmlFor="li-said">Spoken words {project.language === "tanglish" || project.language === "tamil" ? "(Tamil letters)" : project.language === "hindi" || project.language === "hinglish" ? "(Hindi letters)" : ""}</label>
                  <textarea id="li-said" className="field" rows={3} defaultValue={line.text} onBlur={(e) => e.target.value.trim() !== line.text && patchLine(i, { text: e.target.value })} />
                  {spokenProblem && <p className="hint li-warn">This line is {spokenProblem.why} — the {language.name} voice will read it oddly.</p>}
                </div>
                <div>
                  <label className="lbl" htmlFor="li-sub">Subtitle <span className="li-opt">— leave empty to show the spoken words</span></label>
                  <input id="li-sub" className="field" defaultValue={line.caption === line.text ? "" : line.caption} onBlur={(e) => e.target.value.trim() !== (line.caption === line.text ? "" : line.caption) && patchLine(i, { caption: e.target.value })} />
                </div>
                <div>
                  <label className="lbl" htmlFor="li-pause">Pause before this line · {(line.pause ?? 0).toFixed(1)} s</label>
                  <input id="li-pause" type="range" min={0} max={4} step={0.1} value={line.pause ?? 0} onChange={(e) => patchLine(i, { pause: Number(e.target.value) })} />
                </div>
                <div className="li-actions">
                  <button type="button" className="btn btn-sm" onClick={() => hearLine(i)}><Play size={14} /> Play from here</button>
                  <button type="button" className="btn btn-sm btn-icon" disabled={i === 0} onClick={() => shiftLine(i, -1)} aria-label="Move earlier" title="Move earlier"><ArrowUp size={15} /></button>
                  <button type="button" className="btn btn-sm btn-icon" disabled={i >= parsed.lines.length - 1} onClick={() => shiftLine(i, 1)} aria-label="Move later" title="Move later"><ArrowDown size={15} /></button>
                  <button type="button" className="btn btn-sm btn-icon" onClick={() => copyLine(i)} aria-label="Duplicate" title="Duplicate"><CopyPlus size={15} /></button>
                  <button type="button" className="btn btn-sm btn-icon li-del" onClick={() => removeLine(i)} aria-label="Delete line" title="Delete line"><Trash2 size={15} /></button>
                </div>
                <div className="li-nav">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => { selectLine(i - 1); player.seek(timeline.spans[i - 1].start + 0.01); }}>← Previous line</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={i >= parsed.lines.length - 1} onClick={() => { selectLine(i + 1); player.seek(timeline.spans[i + 1].start + 0.01); }}>Next line →</button>
                </div>
                <p className="hint">Changing the words or who says it records that line again when you play. Mood and pauses don&apos;t need a new recording.</p>
              </div>
            );
          })()}

          {tab === "cast" && (
            <div className="grid gap-4">
              {project.cast.length === 0 && <p className="hint">Names from your script appear here.</p>}
              {project.cast.map((member) => (
                <div key={member.name} className="card grid gap-2 p-3" style={{ background: "var(--surface-2)", borderLeft: `3px solid ${speakerColor(member.name)}` }}>
                  <div className="flex items-center gap-3">
                    {characters ? <Avatar id={member.characterId} size={52} /> : <span className="voice-dot" style={{ background: speakerColor(member.name) }}><Mic size={18} /></span>}
                    <strong className="display" style={{ fontSize: 16, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</strong>
                    <button type="button" className="btn btn-sm" disabled={busy || testing !== ""} onClick={() => testVoice(member)} title="Hear this voice say one line (uses one request of your key)">
                      {testing === member.name ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} Test voice
                    </button>
                  </div>
                  {characters && <Select<string> ariaLabel={`Character for ${member.name}`} search value={member.characterId} onChange={(id) => setMember(member.name, { characterId: id, voice: characterById(id).voice })} options={characterOptions} leading={<Users size={16} style={{ opacity: 0.6, flex: "none" }} />} />}
                  <Select<string> ariaLabel={`Voice for ${member.name}`} search value={member.voice} onChange={(v) => setMember(member.name, { voice: v })} options={voiceOptions} leading={<AudioLines size={16} style={{ opacity: 0.6, flex: "none" }} />} />
                </div>
              ))}
              {!characters && (
                <p className="note note-info">Text-only video: no people on screen. Each name only picks a voice — write lines without a name and they go to the last speaker (or “Narrator”).</p>
              )}
              {characters && <div>
                <h3 className="display" style={{ fontSize: 16, marginBottom: 4 }}>Character library · {CHARACTERS.length}</h3>
                <p className="hint" style={{ marginBottom: 10 }}>Tap a character to give them a line in the script.</p>
                <div className="own-mini">
                  <b>Your own character</b>
                  <span>Design one with your own face, hair and outfit — coming soon. When 100 people ask, we build it.</span>
                  <FeatureVote feature="own-character" compact />
                </div>
                {STYLES.map((style) => (
                  <div key={style.id} style={{ marginBottom: 16 }}>
                    <p className="lbl" style={{ margin: "4px 0 8px" }}>{style.name}</p>
                    <div className="lib-grid">
                      {CHARACTERS.filter((c) => c.style === style.id).map((c) => {
                        const inVideo = project.cast.some((m) => m.characterId === c.id);
                        return (
                          <button key={c.id} type="button" className="lib-card" data-in={inVideo} onClick={() => insert(`${c.name}: `)} title={`${c.name} — ${c.blurb}. Voice: ${c.voice}`}>
                            <Avatar id={c.id} size={58} />
                            <b>{c.name}</b>
                            <small>{c.blurb}</small>
                            {inVideo && <span className="lib-badge">In video</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          )}

          {tab === "scene" && (
            <div className="grid gap-4">
              <Field label="Video shape"><Seg label="Video shape" value={project.format} onChange={(v) => set("format", v)} items={FORMATS} /></Field>
              <div>
                <span className="lbl">Background</span>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" className="swatch" aria-pressed={project.background === "plain"} title="A plain colour screen" onClick={() => set("background", "plain")} style={{ background: project.plainColor }}>
                    <span>Plain colour</span>
                  </button>
                  {BACKGROUNDS.map((b) => (
                    <button key={b.id} type="button" className="swatch" aria-pressed={project.background === b.id} aria-label={b.name} title={b.name} onClick={() => set("background", b.id)} style={{ background: `linear-gradient(${b.swatch[0]} 0 66%, ${b.swatch[1]} 66%)` }}>
                      <span>{b.name}</span>
                    </button>
                  ))}
                  <button type="button" className="swatch" aria-pressed={project.background === "custom" && Boolean(assets.bgImage)} title="Use your own picture" onClick={() => (assets.bgImage ? set("background", "custom") : bgFileRef.current?.click())} style={{ background: "var(--surface-3)", color: "var(--muted)", display: "grid", placeItems: "center" }}>
                    <ImagePlus size={20} style={{ marginBottom: 12 }} />
                    <span>{assets.bgImage ? "Your picture" : "Picture"}</span>
                  </button>
                  <button type="button" className="swatch" aria-pressed={project.background === "video" && Boolean(assets.bgVideo)} title="Use your own video behind everything" onClick={() => (assets.bgVideo ? set("background", "video") : videoFileRef.current?.click())} style={{ background: "var(--surface-3)", color: "var(--muted)", display: "grid", placeItems: "center" }}>
                    <Film size={20} style={{ marginBottom: 12 }} />
                    <span>{assets.bgVideo ? "Your video" : "Video"}</span>
                  </button>
                </div>
                <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => { void pickBackground(e.target.files?.[0]); e.target.value = ""; }} />
                <input ref={videoFileRef} type="file" accept="video/*" hidden onChange={(e) => { void pickVideo(e.target.files?.[0]); e.target.value = ""; }} />
                {loadingMedia && <p className="hint" style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}><Loader2 size={14} className="animate-spin" /> {loadingMedia}</p>}
                {project.background === "video" && assets.bgVideo && (
                  <div className="media-card">
                    <div className="media-head">
                      <Film size={16} />
                      <b title={assetNames.video}>{assetNames.video || "Your video"}</b>
                      <span>{clock(assets.bgVideo.duration || 0)}</span>
                    </div>
                    <div>
                      <label className="lbl" htmlFor="video-start">Start the video at · {(project.videoStart ?? 0).toFixed(1)} s</label>
                      <input id="video-start" type="range" min={0} max={Math.max(0, Math.floor(((assets.bgVideo.duration || 1) - 0.5) * 10) / 10)} step={0.1} value={project.videoStart ?? 0} onChange={(e) => set("videoStart", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="lbl" htmlFor="video-vol">Video&apos;s own sound · {assets.videoAudio ? `${Math.round((project.videoVolume ?? 0) * 100)}%` : "this video has no sound"}</label>
                      <input id="video-vol" type="range" min={0} max={1} step={0.05} disabled={!assets.videoAudio} value={project.videoVolume ?? 0} onChange={(e) => set("videoVolume", Number(e.target.value))} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-sm" onClick={() => videoFileRef.current?.click()}><Upload size={14} /> Change video</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={removeVideo}><Trash2 size={14} /> Remove</button>
                    </div>
                    <p className="hint" style={{ margin: 0 }}>It loops behind {characters ? "the characters" : "the words"} and is kept in this browser for next time. The sound is heard once the voices are recorded.</p>
                  </div>
                )}
                {project.background === "plain" && (
                  <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 10 }}>
                    {PLAIN_COLORS.map(([c, name]) => (
                      <button key={c} type="button" className="dot" aria-pressed={project.plainColor === c} aria-label={`${name} screen`} title={name} style={{ background: c }} onClick={() => set("plainColor", c)} />
                    ))}
                    <input type="color" aria-label="Custom screen colour" value={project.plainColor} onChange={(e) => set("plainColor", e.target.value)} style={{ width: 34, height: 30, padding: 0, border: "1px solid var(--line-2)", borderRadius: 8, background: "none", cursor: "pointer" }} />
                  </div>
                )}
                {!characters && project.background !== "plain" && <p className="hint" style={{ marginTop: 6 }}>Text-only videos dim the picture so the words stand out. <code>[bg: …]</code> lines in the script are used only with characters.</p>}
                {assets.bgImage && (
                  <p className="hint" style={{ marginTop: 6 }}>
                    {assetNames.bg} · <button type="button" onClick={() => bgFileRef.current?.click()} style={{ background: "none", border: 0, color: "var(--accent-strong)", cursor: "pointer", padding: 0, font: "inherit", textDecoration: "underline" }}>change picture</button>
                  </p>
                )}
              </div>
              {characters && <Field label="Camera"><Seg label="Camera" value={project.camera} onChange={(v) => set("camera", v)} items={CAMERAS} /></Field>}
              {characters && <div>
                <label className="lbl" htmlFor="char-size">Character size · {Math.round(project.charScale * 100)}%</label>
                <input id="char-size" type="range" min={0.7} max={1.25} step={0.05} value={project.charScale} onChange={(e) => set("charScale", Number(e.target.value))} />
              </div>}
              <div>
                <label className="lbl" htmlFor="title">Title on the video</label>
                <input id="title" className="field" value={project.title} onChange={(e) => set("title", e.target.value)} placeholder="Wait for the last line 😂" maxLength={80} />
              </div>
              <div>
                <label className="lbl" htmlFor="handle">Channel name / watermark</label>
                <input id="handle" className="field" value={project.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@YourChannel" maxLength={40} />
              </div>
              <div>
                <label className="lbl" htmlFor="endcard">End card (after the last line)</label>
                <input id="endcard" className="field" value={project.endCard} onChange={(e) => set("endCard", e.target.value)} placeholder="Follow for more 😂" maxLength={40} />
              </div>
              <div className="grid">
                {characters && <Switch checked={project.showNames} onChange={(v) => set("showNames", v)}>Name tags under characters</Switch>}
                <Switch checked={project.punch} onChange={(v) => set("punch", v)}>{characters ? "Punch-line ending (zoom, laughs, reaction)" : "Punch-line ending (bigger last line, ba-dum-tss)"}</Switch>
                <Switch checked={project.progressBar} onChange={(v) => set("progressBar", v)}>Progress bar at the bottom</Switch>
              </div>
            </div>
          )}

          {tab === "captions" && (
            <div className="grid gap-4">
              <Field label="Style"><Seg label="Caption style" value={project.subtitleStyle} onChange={(v) => set("subtitleStyle", v)} items={SUB_STYLES} /></Field>
              <Field label="Position"><Seg label="Caption position" value={project.subtitlePosition} onChange={(v) => set("subtitlePosition", v)} items={SUB_POSITIONS} /></Field>
              <div>
                <label className="lbl" htmlFor="sub-size">Size · {Math.round(project.subtitleSize * 100)}%</label>
                <input id="sub-size" type="range" min={0.7} max={1.4} step={0.05} value={project.subtitleSize} onChange={(e) => set("subtitleSize", Number(e.target.value))} />
              </div>
              <div>
                <span className="lbl">Highlight colour</span>
                <div className="flex flex-wrap items-center gap-3">
                  {HIGHLIGHTS.map((c) => (
                    <button key={c} type="button" className="dot" aria-pressed={project.highlight === c} aria-label={`Highlight colour ${c}`} style={{ background: c }} onClick={() => set("highlight", c)} />
                  ))}
                  <input type="color" aria-label="Custom highlight colour" value={project.highlight} onChange={(e) => set("highlight", e.target.value)} style={{ width: 34, height: 30, padding: 0, border: "1px solid var(--line-2)", borderRadius: 8, background: "none", cursor: "pointer" }} />
                </div>
              </div>
              <Switch checked={project.upper} onChange={(v) => set("upper", v)}>ALL CAPS (English letters)</Switch>
              <p className="hint">Captions come from your script. To show different words from what is spoken, write <code>Name: spoken | subtitle</code>.</p>
            </div>
          )}

          {tab === "audio" && (
            <div className="grid gap-4">
              <Field label="Music">
                <Select<MusicId> ariaLabel="Music" value={project.music} onChange={(v) => (v === "custom" && !assets.music ? musicFileRef.current?.click() : set("music", v))} options={MUSIC} leading={<Music size={16} style={{ opacity: 0.6, flex: "none" }} />} />
              </Field>
              <input ref={musicFileRef} type="file" accept="audio/*" hidden onChange={(e) => { void pickMusic(e.target.files?.[0]); e.target.value = ""; }} />
              {project.music !== "custom" && (
                <button type="button" className="btn" onClick={() => musicFileRef.current?.click()}><Upload size={16} /> Add your own music</button>
              )}
              {loadingMedia && <p className="hint" style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}><Loader2 size={14} className="animate-spin" /> {loadingMedia}</p>}
              {project.music === "custom" && (
                <div className="media-card">
                  <div className="media-head">
                    <Music size={16} />
                    <b title={assetNames.music}>{assets.music ? assetNames.music || "Your music" : "No file yet"}</b>
                    {assets.music && <span>{clock(assets.music.length / MIX_RATE)}</span>}
                  </div>
                  {assets.music && (
                    <div>
                      <label className="lbl" htmlFor="music-start">Start the music at · {(project.musicStart ?? 0).toFixed(1)} s</label>
                      <input id="music-start" type="range" min={0} max={Math.max(0, Math.floor((assets.music.length / MIX_RATE - 1) * 10) / 10)} step={0.1} value={project.musicStart ?? 0} onChange={(e) => set("musicStart", Number(e.target.value))} />
                    </div>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => musicFileRef.current?.click()}><Upload size={14} /> {assets.music ? "Change music" : "Choose an audio file"}</button>
                  <p className="hint" style={{ margin: 0 }}>MP3, WAV or M4A — kept in this browser for next time. Use music you have the rights to.</p>
                </div>
              )}
              <div>
                <label className="lbl" htmlFor="music-vol">Music loudness · {Math.round(project.musicVolume * 100)}%</label>
                <input id="music-vol" type="range" min={0} max={1} step={0.05} value={project.musicVolume} disabled={project.music === "none"} onChange={(e) => set("musicVolume", Number(e.target.value))} />
              </div>
              <Switch checked={project.duck ?? false} onChange={(v) => set("duck", v)}>Music quieter while someone speaks</Switch>
              {project.background === "video" && assets.videoAudio && (
                <div>
                  <label className="lbl" htmlFor="video-vol-2">Background video&apos;s sound · {Math.round((project.videoVolume ?? 0) * 100)}%</label>
                  <input id="video-vol-2" type="range" min={0} max={1} step={0.05} value={project.videoVolume ?? 0} onChange={(e) => set("videoVolume", Number(e.target.value))} />
                </div>
              )}
              <div>
                <label className="lbl" htmlFor="gap">Pause between lines · {project.lineGap.toFixed(2)} s</label>
                <input id="gap" type="range" min={0.05} max={1} step={0.05} value={project.lineGap} onChange={(e) => set("lineGap", Number(e.target.value))} />
              </div>
              <Switch checked={project.sfx} onChange={(v) => set("sfx", v)}>Sound effects (pops, ba-dum-tss)</Switch>
              <Field label="Voice recording" hint="Conversation mode records two speakers together in one request: natural, and light on your key's limit.">
                <Select<Project["voiceMode"]> ariaLabel="Voice recording" value={project.voiceMode} onChange={(v) => set("voiceMode", v)} options={[{ value: "batch", label: "Conversation", hint: "Fewer requests, natural" }, { value: "line", label: "Line by line", hint: "One request per line" }]} />
              </Field>
              <button type="button" className="btn" onClick={() => { void clearVoices(); setVoiced(null); }}>Forget recorded voices</button>
              {!voices && <p className="note note-info">Music and sound effects are heard once the voices are recorded — press <b>Generate voice</b>.</p>}
            </div>
          )}

          {tab === "key" && (
            <div className="grid gap-4">
              <p style={{ color: "var(--muted)" }}>
                The voices are made by Google&apos;s Gemini with <b style={{ color: "var(--fg)" }}>your own free key</b>. It takes a minute and needs no card.
              </p>
              <a className="btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"><KeyRound size={16} /> Get a key from Google AI Studio ↗</a>
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <span className="lbl" style={{ margin: 0 }}>Your keys{keys.length ? ` · ${keys.length}` : ""}</span>
                  {keys.length > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide" : "Show"}</button>
                  )}
                </div>
                {keys.length === 0 && <p className="hint" style={{ margin: "0 0 8px" }}>No key yet. Paste one below.</p>}
                <ul className="key-list">
                  {keys.map((k, i) => {
                    const r = keyReport(k);
                    const allResting = r.tts !== undefined && r.tts > 0 && r.ttsResting >= r.tts;
                    const state = r.dead ? "dead" : allResting ? "rest" : r.tts !== undefined ? "ok" : "new";
                    const back = r.backAt ? new Date(r.backAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
                    const text = r.dead
                      ? r.dead
                      : allResting
                        ? `Voice limit used on every model — back at ${back}`
                        : r.tts !== undefined
                          ? `Works · ${r.tts} voice + ${r.text} text models${r.ttsResting ? ` · ${r.ttsResting} resting till ${back}` : ""}`
                          : "Not checked yet";
                    return (
                      <li key={k} className="key-row" data-state={state}>
                        <span className="key-n">{i + 1}</span>
                        <div className="key-main">
                          <code>{showKey ? k : mask(k)}</code>
                          <small>
                            <i aria-hidden="true" />
                            {text}
                            {r.active && state === "ok" && <b> · in use</b>}
                          </small>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ width: 30 }} onClick={() => removeKey(k)} aria-label={`Remove key ${i + 1}`} title="Remove this key"><X size={15} /></button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <label className="lbl" htmlFor="key">{keys.length ? "Add another key" : "Paste your key"}</label>
                <div className="flex gap-2">
                  <input
                    id="key"
                    className="field"
                    style={{ fontFamily: "ui-monospace, monospace" }}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeys(); } }}
                    onPaste={(e) => { const t = e.clipboardData.getData("text"); if (t.trim()) { e.preventDefault(); setNewKey((v) => `${v}${v ? "," : ""}${t.trim()}`); } }}
                    placeholder="AIza…"
                  />
                  <button type="button" className="btn btn-teal" disabled={!newKey.trim()} onClick={addKeys}><Plus size={16} /> Add</button>
                </div>
                <p className="hint" style={{ marginTop: 6 }}>You can paste several at once, separated by commas or new lines.</p>
              </div>
              {keys.length > 0 && <button type="button" className="btn" onClick={() => void testKeys()}><RefreshCw size={15} /> Check all keys</button>}
              {keyState && <p className={`note ${keyState.ok ? "note-ok" : "note-error"}`} role="status">{keyState.text}</p>}
              <div className="note" style={{ display: "grid", gap: 4 }}>
                <b style={{ color: "var(--fg)" }}>How more keys help</b>
                <span>Google&apos;s free limit counts per key <i>and</i> per model. Video Maker uses every voice model of your first key, then the next key, and so on — when one runs out, the next takes over by itself, and it comes back when its limit resets.</span>
              </div>
              <p className="hint">🔒 Saved only in this browser and sent only to Google.</p>
            </div>
          )}

          {tab === "export" && (
            <div className="grid gap-4">
              <Field label="Quality"><Select<Quality> ariaLabel="Video quality" value={quality} onChange={setQuality} options={QUALITIES} /></Field>
              <Field label="Frames per second"><Seg label="Frames per second" value={fps} onChange={setFps} items={[{ id: 30, name: "30 fps" }, { id: 60, name: "60 fps (smoother)" }]} /></Field>
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => exportVideo(false)}>
                <Download size={18} /> {voices ? "Export MP4" : "Record voice & export MP4"}
              </button>
              {!voices && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => exportVideo(true)}>Export a silent draft instead</button>
              )}
              {video && !busy && (
                <div className="grid gap-3">
                  {video.sig !== projectSig && <p className="note note-info">You changed something since this video was made — export again to include it.</p>}
                  {video.silent && <p className="note note-info">This one is a silent draft: it has no voice.</p>}
                  <video src={video.url} controls playsInline style={{ width: "100%", maxHeight: 300, borderRadius: 12, border: "1px solid var(--line-2)", background: "#000" }} />
                  <button type="button" className="btn btn-teal btn-lg" onClick={() => download(video.blob, `${fileName}.${video.ext}`)}>
                    <Download size={18} /> Download {video.ext.toUpperCase()} · {(video.blob.size / 1_048_576).toFixed(1)} MB
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="btn btn-sm" onClick={() => download(new Blob([toSrt(timeline)], { type: "text/plain" }), `${fileName}.srt`)}><Captions size={14} /> Subtitles .srt</button>
                    <button type="button" className="btn btn-sm" onClick={aiMeta}><Sparkles size={14} /> Title &amp; tags</button>
                  </div>
                  <div className="flow-card">
                    <div>
                      <b>Upload &amp; schedule on YouTube</b>
                      {embedded ? (
                        <p>Add this video to Ready to Post and schedule it from there. {meta ? "Your AI title and description go with it." : "Tip: make a title & tags first and they go with it."}</p>
                      ) : (
                        <p>Send this video to <a href={UTUBEFLOW_URL} target="_blank" rel="noopener noreferrer">UTubeFlow</a>, our free YouTube scheduler — no download needed. {meta ? "Your AI title and description go with it." : "Tip: make a title & tags first and they go with it."}</p>
                      )}
                    </div>
                    <button type="button" className="btn btn-primary" disabled={flow.state === "opening" || flow.state === "linked"} onClick={sendToFlow}>
                      {flow.state === "opening" || flow.state === "linked" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {embedded ? "Add to Ready to Post" : "Send to UTubeFlow"}
                    </button>
                    {flow.text && <p className={`note ${flow.state === "error" ? "note-error" : flow.state === "done" ? "note-ok" : "note-info"}`} style={{ margin: 0 }}>{flow.text}</p>}
                  </div>
                </div>
              )}
              {meta && (
                <div className="grid gap-3">
                  {([["Title", meta.title], ["Description", meta.description], ["Tags", meta.tags.join(", ")]] as const).map(([name, text]) => (
                    <div key={name}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span className="lbl" style={{ margin: 0 }}>{name}</span>
                        <button type="button" className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(text)}>Copy</button>
                      </div>
                      <p className="note" style={{ whiteSpace: "pre-wrap", fontSize: 13.5, maxHeight: 150, overflow: "auto", margin: 0 }}>{text}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <span className="lbl">Project file</span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-sm" onClick={() => download(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${fileName}.videomaker.json`)}><Save size={14} /> Save project</button>
                  <button type="button" className="btn btn-sm" onClick={() => projectFileRef.current?.click()}><FolderOpen size={14} /> Open project</button>
                </div>
                <input ref={projectFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void openProject(e.target.files?.[0]); e.target.value = ""; }} />
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setProject(defaultProject(project.language)); setVideo(null); setMeta(null); }}>Start a new project</button>
              </div>
            </div>
          )}
        </section>

        <main className="ed-main">
          <div className="ed-cast" aria-label={characters ? "Characters in this video" : "Voices in this video"}>
            <span className="ed-cast-lbl">{characters ? "Cast" : "Voices"}</span>
            {project.cast.map((m) => (
              <button key={m.name} type="button" className="cast-chip" onClick={() => setTab("cast")} title={`${m.name}: change ${characters ? "character or " : ""}voice`}>
                {characters ? <Avatar id={m.characterId} size={30} /> : <span className="cast-dot" style={{ background: speakerColor(m.name) }} />}
                <span>
                  <b>{m.name}</b>
                  <small>{characters ? `${characterById(m.characterId).name} · ` : ""}{m.voice}</small>
                </span>
              </button>
            ))}
            {project.cast.length === 0 && <span className="hint">Write a line in the script to add someone.</span>}
            <span className="ed-cast-mode" title="Video type">
              {characters ? <Users size={13} /> : <Type size={13} />} {characters ? "With characters" : "Text only"}
            </span>
          </div>
          <div className="ed-stage">
            <canvas ref={player.canvasRef} width={player.width} height={player.height} onClick={playOrVoice} role="img" aria-label="Video preview. Press to play or pause." />
            {!voices && !busy && !player.playing && !draftOk && parsed.lines.length > 0 && (
              <div className="voice-gate" role="note">
                <span className="voice-gate-icon" aria-hidden="true"><Volume2 size={20} /></span>
                <div className="voice-gate-text">
                  <strong>No voice yet</strong>
                  <p>
                    {keys.length
                      ? "Press play: voices are recorded with your Gemini key, then it plays with music and sound."
                      : "Voices come from Google Gemini. Add your free API key to hear them."}
                  </p>
                </div>
                <div className="voice-gate-actions">
                  <button type="button" className="btn btn-accent" onClick={playOrVoice}>
                    {keys.length ? <><Play size={16} /> Play with voice</> : <><KeyRound size={16} /> Add Gemini key</>}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraftOk(true); player.play(); }}>Silent draft</button>
                </div>
              </div>
            )}
          </div>
          <div className="ed-transport">
            <span className="tp-time">
              {clock(player.time)} <span>/ {clock(timeline.duration)}</span>
            </span>
            <div className="tp-ctrls">
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => jump(-1)} aria-label="Previous line" title="Previous line"><SkipBack size={17} /></button>
              <button type="button" className="tp-play" onClick={playOrVoice} aria-label={player.playing ? "Pause" : "Play"} title="Play / pause (Space)">
                {player.playing ? <Pause size={19} /> : <Play size={19} style={{ marginLeft: 2 }} />}
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => jump(1)} aria-label="Next line" title="Next line"><SkipForward size={17} /></button>
            </div>
            <div className="tp-now" aria-live="off">
              {currentSpan && (
                <>
                  <i style={{ background: speakerColor(currentSpan.line.speaker) }} />
                  <b>{currentSpan.line.speaker}</b>
                  <span>{currentSpan.line.caption}</span>
                </>
              )}
            </div>
          </div>
          <Tracks
            timeline={timeline} time={player.time} onSeek={player.seek} project={project} colorOf={speakerColor} characters={characters}
            selected={tab === "line" ? selected : null} onSelect={selectLine} onOpen={(t) => { setSelected(null); setTab(t); }} videoName={assetNames.video}
          />
        </main>
      </div>

      {ai.open && (() => {
        const writing = status.phase === "writing";
        const review = ai.stage === "review";
        const live = (
          <div className="ai-live" role="status" aria-live="polite">
            <div className="ai-live-head">
              <Loader2 size={15} className="animate-spin" />
              <span>{aiLive ? "Writing…" : "Gemini is thinking…"}</span>
              {aiLive && <span className="ai-live-count">{parseScript(cleanPastedScript(aiLive).script).lines.length} lines</span>}
            </div>
            <pre>{aiLive || " "}</pre>
          </div>
        );
        return (
          <div className="dlg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !writing) closeAi(); }}>
            <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="ai-title">
              <header className="dlg-head">
                <span className="ed-panel-icon" aria-hidden="true">{review ? <Check size={18} /> : <Sparkles size={18} />}</span>
                <div>
                  <h2 id="ai-title">{review ? "Check the script" : "Write the script with AI"}</h2>
                  <p>{review ? "Read it, fix anything, then make the video. Nothing changes until you say so." : "Pick the language, say what happens — you check the script before anything is made."}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" onClick={closeAi} aria-label="Close"><X size={18} /></button>
              </header>

              {!review ? (
                <div className="dlg-body">
                  <div>
                    <span className="lbl">Voice language — what the characters speak</span>
                    <div className="lang-pick" role="radiogroup" aria-label="Voice language">
                      {LANGUAGES.map((l) => (
                        <button key={l.id} type="button" role="radio" aria-checked={project.language === l.id} disabled={writing} onClick={() => set("language", l.id)}>
                          <b>{l.name}</b>
                          <small>{LANGUAGE_VOICE[l.id]}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="lbl" htmlFor="ai-topic">What is the video about?</label>
                    <textarea id="ai-topic" ref={aiTopicRef} className="field" rows={2} value={ai.topic} disabled={writing} onChange={(e) => setAi({ ...ai, topic: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && ai.via === "gemini") { e.preventDefault(); void aiScript(); } }} placeholder="A boy explains to his mom why he failed the exam" />
                  </div>
                  <div className="dlg-grid dlg-grid-3">
                    <Field label="Tone"><Select<string> ariaLabel="Tone" value={ai.tone} onChange={(v) => setAi({ ...ai, tone: v })} options={TONES} /></Field>
                    <Field label="Lines"><Select<number> ariaLabel="Number of lines" value={ai.lines} onChange={(v) => setAi({ ...ai, lines: v })} options={[4, 5, 6, 8, 10, 12, 16, 20].map((n) => ({ value: n, label: `${n} lines` }))} /></Field>
                    <Field label="People">
                      {keepCast ? (
                        <div className="sel-btn" aria-disabled="true"><span className="sel-text">{project.cast.length} (current)</span></div>
                      ) : (
                        <Select<number> ariaLabel="Number of people" value={ai.people} onChange={(v) => setAi({ ...ai, people: v })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 1 ? "1 person" : `${n} people` }))} />
                      )}
                    </Field>
                  </div>
                  {project.cast.length > 0 && (
                    <div>
                      <span className="lbl">Who&apos;s in it</span>
                      <Seg<string>
                        label="Who's in it"
                        value={ai.pick ? "pick" : "keep"}
                        onChange={(v) => setAi({ ...ai, pick: v === "pick" })}
                        items={[{ id: "pick", name: "AI picks who fits the story" }, { id: "keep", name: `Keep ${project.cast.map((c) => c.name).join(", ")}` }]}
                      />
                    </div>
                  )}

                  <div className="dlg-tabs" role="tablist" aria-label="Which AI writes it">
                    <button type="button" role="tab" aria-selected={ai.via === "gemini"} disabled={writing} onClick={() => { setAi({ ...ai, via: "gemini" }); setAiError(""); }}>
                      <Sparkles size={16} />
                      <span><b>Gemini</b><small>Writes it here, with your key</small></span>
                    </button>
                    <button type="button" role="tab" aria-selected={ai.via === "paste"} disabled={writing} onClick={() => { setAi({ ...ai, via: "paste" }); setAiError(""); }}>
                      <Copy size={16} />
                      <span><b>Copy &amp; paste</b><small>ChatGPT, Claude or any AI</small></span>
                    </button>
                  </div>

                  {ai.via === "gemini" ? (
                    writing ? live : null
                  ) : (
                    <ol className="ai-steps">
                      <li>
                        <div className="ai-step-head">
                          <b>Copy the prompt and send it to any AI</b>
                          <button type="button" className={`btn btn-sm ${copied ? "" : "btn-primary"}`} onClick={() => void copyPrompt()}>
                            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy prompt</>}
                          </button>
                        </div>
                        <div className="ai-links">
                          {OTHER_AIS.map((o) => (
                            <a key={o.name} className="btn btn-sm" href={ai.topic.trim() ? o.url(scriptPrompt(aiAsk(), true)) : undefined} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!ai.topic.trim()) e.preventDefault(); void copyPrompt(); }}>
                              {o.name} <ExternalLink size={13} />
                            </a>
                          ))}
                        </div>
                        <details className="ai-prompt">
                          <summary>See the prompt</summary>
                          <pre>{scriptPrompt(aiAsk(), true)}</pre>
                        </details>
                      </li>
                      <li>
                        <label className="ai-step-head" htmlFor="ai-paste"><b>Paste its reply here</b></label>
                        <textarea id="ai-paste" className="field" rows={6} spellCheck={false} value={ai.pasted} onChange={(e) => { setAi({ ...ai, pasted: e.target.value }); setAiError(""); }} placeholder={"Paste the whole reply — the extra words around the script are cleaned up.\n\n[bg: classroom]\nChintu (sad): Amma, naan fail aayitten…"} />
                        {ai.pasted.trim() && (
                          pastedLines.length ? (
                            <p className="ai-check" data-ok="true">
                              <Check size={14} /> {pastedLines.length} lines · {[...new Set(pastedLines.map((l) => l.speaker))].join(", ")}
                              {pastedScript.title && <> · title “{pastedScript.title}”</>}
                            </p>
                          ) : (
                            <p className="ai-check">No lines found yet — each line should look like <code>Meena: words</code></p>
                          )
                        )}
                      </li>
                    </ol>
                  )}
                  {aiErrorNote}
                </div>
              ) : (
                <div className="dlg-body">
                  <div className="rv-summary">
                    <span><b>{draftLines.length}</b> lines</span>
                    <span>about <b>{Math.round(buildTimeline(draftLines, project, null).duration)}</b> s</span>
                    <span>Voice: <b>{language.name}</b></span>
                  </div>

                  {writing ? live : draftProblems.length ? (
                    <div className="note note-warn rv-problems">
                      <div>
                        <b>{draftProblems.length} {draftProblems.length === 1 ? "line isn't" : "lines aren't"} in {language.name}</b> — the voice reads exactly what is written, so {draftProblems.length === 1 ? "it" : "they"} would sound wrong.
                        <ul>{draftProblems.slice(0, 4).map((p) => <li key={p.index}>Line {p.index + 1}: {p.why}</li>)}</ul>
                      </div>
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void fixDraft()}><Sparkles size={14} /> Fix with Gemini</button>
                    </div>
                  ) : (
                    <p className="note note-ok rv-ok"><Check size={15} /> Every line is in {language.name}{project.language === "tanglish" ? " (Tamil voice, English-letter subtitles)" : project.language === "hinglish" ? " (Hindi voice, English-letter subtitles)" : ""}.</p>
                  )}

                  <div>
                    <label className="lbl" htmlFor="rv-title">Title on the video</label>
                    <input id="rv-title" className="field" value={ai.draftTitle} maxLength={80} onChange={(e) => setAi({ ...ai, draftTitle: e.target.value })} placeholder={ai.topic.trim() || "A short hook"} />
                  </div>
                  <div>
                    <span className="lbl">Who plays whom</span>
                    <div className="rv-cast">
                      {draftCast.map((m) => (
                        <span key={m.name} className="rv-person">
                          {characters ? <Avatar id={m.characterId} size={30} /> : <span className="cast-dot" style={{ background: speakerColor(m.name) }} />}
                          <span><b>{m.name}</b><small>{characters ? `${characterById(m.characterId).name} · ` : ""}{m.voice}</small></span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="script-head">
                      <span className="lbl">The script</span>
                      <button type="button" className="link-btn" onClick={() => setDraftEdit((v) => !v)}>{draftEdit ? "Done editing" : "Edit"}</button>
                    </div>
                    {draftEdit ? (
                      <textarea className="field script-area" rows={10} spellCheck={false} value={ai.draft} onChange={(e) => setAi({ ...ai, draft: e.target.value })} aria-label="Script" />
                    ) : (
                      <ol className="rv-lines">
                        {draftLines.map((l, i) => {
                          const problem = draftProblems.find((p) => p.index === i);
                          return (
                            <li key={i} data-bad={Boolean(problem)} style={{ borderLeftColor: SPEAKER_COLORS[Math.max(0, draftCast.findIndex((c) => c.name === l.speaker)) % SPEAKER_COLORS.length] }}>
                              <div className="rv-who"><b>{l.speaker}</b>{l.mood && l.mood !== "normal" && <small>{MOOD_NAMES[l.mood]}</small>}{l.bg && <small>· {BACKGROUNDS.find((b) => b.id === l.bg)?.name ?? l.bg}</small>}</div>
                              <div className="rv-said">{l.text}</div>
                              {l.caption !== l.text && <div className="rv-sub">{l.caption}</div>}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                  {aiErrorNote}
                </div>
              )}

              <footer className="dlg-foot">
                {writing ? (
                  <button type="button" className="btn" onClick={() => abortRef.current?.abort()}><Square size={13} /> Stop</button>
                ) : review ? (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => { setAi({ ...ai, stage: "write" }); setDraftEdit(false); setAiError(""); }}><ArrowLeft size={15} /> Back</button>
                    {ai.via === "gemini" && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void aiScript()}><RefreshCw size={14} /> Write again</button>}
                    <span className="dlg-spacer" />
                    <button type="button" className="btn" disabled={!draftLines.length} onClick={() => confirmDraft(false)}>Use script</button>
                    <button type="button" className="btn btn-accent" disabled={!draftLines.length || busy} onClick={() => confirmDraft(true)}>
                      <Mic size={16} /> Make it with voice
                    </button>
                  </>
                ) : ai.via === "gemini" ? (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={closeAi}>Cancel</button>
                    <button type="button" className="btn btn-accent" disabled={busy} onClick={() => void aiScript()}>
                      <Sparkles size={16} /> Write it in {language.name}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={closeAi}>Cancel</button>
                    <button type="button" className="btn btn-accent" disabled={!pastedLines.length} onClick={takePasted}>
                      Next: check the script <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </footer>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
