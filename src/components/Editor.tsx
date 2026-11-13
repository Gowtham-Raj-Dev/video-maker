"use client";

import {
  AudioLines, Captions, Check, Clapperboard, Download, FileText, FolderOpen, Image as ImageIcon, ImagePlus, KeyRound, Loader2, Mic, Music, Pause, Play, Plus, RefreshCw, Save, SkipBack, SkipForward, Sparkles, Square, Type, Upload, Users, Volume2, X,
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
import { CHARACTERS, STYLES, VOICES, characterById } from "@/engine/characters";
import { canEncodeMp4, exportMp4, exportRecording, toSrt, type Quality } from "@/engine/export";
import { checkKey, speak, splitKeys, withKeys, writeMeta, writeScript, type VideoMeta } from "@/engine/gemini";
import { LANGUAGES, MOODS, SAMPLES, defaultProject, parseScript, syncCast } from "@/engine/script";
import { clearVoices, loadKeys, loadProject, saveKeys, saveProject } from "@/engine/store";
import { MIX_RATE, type Assets, type CameraStyle, type CastMember, type Format, type LanguageId, type MusicId, type Project, type SubtitlePosition, type SubtitleStyle, type Timeline, type VideoMode } from "@/engine/types";
import { recordVoices, type LineVoice } from "@/engine/voice";
import { SITE } from "@/lib/site";
import { UTUBEFLOW_URL, sendToUTubeFlow } from "@/lib/utubeflow";

type Tab = "script" | "cast" | "scene" | "captions" | "audio" | "key" | "export";
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
const EMPTY_ASSETS: Assets = { bgImage: null, bgSize: [1, 1], music: null };

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
function Tracks({ timeline, time, onSeek, project, colorOf, characters }: {
  timeline: Timeline; time: number; onSeek: (t: number) => void; project: Project; colorOf: (name: string) => string; characters: boolean;
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
  const sceneName = (id: string) => (id === "plain" ? "Plain colour" : id === "custom" ? "Your picture" : BACKGROUNDS.find((b) => b.id === id)?.name ?? id);
  const sceneSwatch = (id: string) => {
    if (id === "plain") return project.plainColor;
    const b = BACKGROUNDS.find((x) => x.id === id);
    return b ? `linear-gradient(${b.swatch[0]} 0 60%, ${b.swatch[1]} 60%)` : "var(--surface-3)";
  };
  const scenes: Array<{ id: string; start: number; end: number }> = [];
  let curBg = project.background;
  let from = 0;
  if (characters) {
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
              return (
                <div key={i} className="tl2-clip" data-on={on} title={`${s.line.speaker}: ${s.line.caption}`} style={{ left: pct(s.start), width: pct(s.end - s.start), borderColor: c, background: `color-mix(in srgb, ${c} ${on ? 34 : 20}%, white)` }}>
                  <b>{s.line.speaker}</b>
                  <span>{s.line.caption}</span>
                </div>
              );
            })}
          </div>
          <div className="tl2-lane tl2-sm">
            {scenes.map((s, i) => (
              <div key={i} className="tl2-bar" style={{ left: pct(s.start), width: pct(s.end - s.start) }}>
                <i style={{ background: sceneSwatch(s.id) }} />
                <span>{sceneName(s.id)}</span>
              </div>
            ))}
          </div>
          <div className="tl2-lane tl2-sm">
            {project.music === "none" ? (
              <span className="tl2-empty">No music</span>
            ) : (
              <div className="tl2-bar tl2-music" style={{ left: 0, width: "100%", opacity: 0.45 + project.musicVolume * 0.55 }}>
                <span>{musicName}{timeline.silent ? " · plays once voices are recorded" : ""}</span>
              </div>
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
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("script");
  const [keysText, setKeysText] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<{ ok: boolean; text: string } | null>(null);
  const [voiced, setVoiced] = useState<{ sig: string; voices: LineVoice[] } | null>(null);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [error, setError] = useState("");
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string; sig: string; silent: boolean } | null>(null);
  const [quality, setQuality] = useState<Quality>(1080);
  const [fps, setFps] = useState(30);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [fonts, setFonts] = useState(0);
  const [ai, setAi] = useState({ open: false, topic: "", tone: "funny", lines: 6, people: 2 });
  const [assets, setAssets] = useState<Assets>(EMPTY_ASSETS);
  const [assetNames, setAssetNames] = useState({ bg: "", music: "" });
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
    () => buildTimeline(parsed.lines, project, voices, assets.music),
    // Only what changes the timing or the sound; looks are read at draw time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, voices, project.music, project.musicVolume, project.sfx, project.punch, project.lineGap, assets.music],
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
      const full = silent ? buildTimeline(parsed.lines, project, null, assets.music) : buildTimeline(parsed.lines, project, await makeVoices(false, signal), assets.music);
      await renderVideo(full, signal);
    });
  };

  async function aiScript() {
    setError("");
    if (!ai.topic.trim()) return setError("Tell the AI what the video is about.");
    if (!keys.length) return needKey();
    const names = [...project.cast.map((c) => c.name), ...CHARACTERS.map((c) => c.name).filter((n) => !project.cast.some((c) => c.name === n))].slice(0, ai.people);
    setStatus({ phase: "writing", note: "Gemini is writing your script…", share: 0.5 });
    try {
      setScript(await withKeys(keys, (key) => writeScript(key, { topic: ai.topic.trim(), language: project.language, tone: ai.tone, lines: ai.lines, names, backgrounds: BACKGROUNDS.slice(0, 12).map((b) => b.id) })));
      setAi((a) => ({ ...a, open: false }));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
    }
  }

  async function aiMeta() {
    setError("");
    if (!keys.length) return needKey();
    setStatus({ phase: "writing", note: "Gemini is writing the title, description and tags…", share: 0.5 });
    try {
      setMeta(await withKeys(keys, (key) => writeMeta(key, project.script, language.name)));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
    }
  }

  async function testKey() {
    if (!keys.length) return setKeyState({ ok: false, text: "Paste a key first." });
    setKeyState({ ok: true, text: "Checking…" });
    try {
      for (const key of keys) await checkKey(key);
      setKeyState({ ok: true, text: keys.length > 1 ? `All ${keys.length} keys work.` : "This key works. Press “Generate voice” to hear your characters." });
    } catch (e) {
      setKeyState({ ok: false, text: messageOf(e) });
    }
  }

  /** Speaks one of the member's lines in their voice, to hear it before recording everything. */
  async function testVoice(member: CastMember) {
    setError("");
    if (!keys.length) return needKey();
    setTesting(member.name);
    try {
      const text = parsed.lines.find((l) => l.speaker === member.name)?.text ?? `Hello, I am ${member.name}.`;
      const pcm = await withKeys(keys, (key) => speak(key, [{ speaker: member.name, text }], { [member.name]: member.voice }));
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

  async function pickBackground(file: File | undefined) {
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      setAssets((a) => ({ ...a, bgImage: image, bgSize: [image.width, image.height] }));
      setAssetNames((n) => ({ ...n, bg: file.name }));
      set("background", "custom");
    } catch {
      setError("That picture couldn't be opened. Try a JPG or PNG.");
    }
  }

  async function pickMusic(file: File | undefined) {
    if (!file) return;
    try {
      // Decoding in a context at the mix's rate gives the track already resampled.
      const decoded = await new OfflineAudioContext(1, 1, MIX_RATE).decodeAudioData(await file.arrayBuffer());
      const length = Math.min(decoded.length, MIX_RATE * 300);
      const mono = new Float32Array(length);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const data = decoded.getChannelData(c);
        for (let i = 0; i < length; i++) mono[i] += data[i] / decoded.numberOfChannels;
      }
      setAssets((a) => ({ ...a, music: mono }));
      setAssetNames((n) => ({ ...n, music: file.name }));
      set("music", "custom");
    } catch {
      setError("That audio file couldn't be opened. Try an MP3, WAV or M4A.");
    }
  }

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
    setFlow({ state: "opening", text: "Opening UTubeFlow… sign in there if it asks." });
    try {
      const description = meta?.description ?? project.script.split("\n").filter((l) => l.includes(":")).map((l) => l.replace(/\s*\([^)]*\)\s*:/, ":").split("|").pop()!.trim()).join("\n");
      const count = await sendToUTubeFlow(
        { blob: video.blob, fileName: `${fileName}.${video.ext}`, title: meta?.title || project.title || "Cartoon video", description, kind: project.format === "9:16" ? "short" : "video" },
        () => setFlow({ state: "linked", text: "Connected — sending the video…" }),
      );
      setFlow({ state: "done", text: count ? "Sent! It's in your UTubeFlow upload list — schedule it there." : "UTubeFlow got the message but no video. Try again." });
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
        <Link href="/" className="ed-brand" title="Back to the home page">
          <Logo size={28} />
          <span className="hidden md:inline">{SITE.name}</span>
        </Link>
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
        {busy && (
          <div className="ed-status" role="status" aria-live="polite">
            <Loader2 size={16} className="animate-spin" style={{ flex: "none" }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status.note}</span>
            <div className="bar" style={{ flex: 1, minWidth: 60 }}><i style={{ width: `${Math.round(status.share * 100)}%` }} /></div>
            {status.phase !== "writing" && (
              <button type="button" className="btn btn-sm" onClick={() => abortRef.current?.abort()}><Square size={12} /> Stop</button>
            )}
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

        <section className="ed-panel" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.name}>
          {(() => {
            const info = TABS.find((t) => t.id === tab)!;
            return (
              <div className="ed-panel-head">
                <span className="ed-panel-icon" aria-hidden="true">{info.icon}</span>
                <div>
                  <h2>{info.id === "cast" && !characters ? "Voices" : info.title}</h2>
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
              <div>
                <label className="lbl" htmlFor="script">Dialogue — Name (mood): words</label>
                <textarea id="script" ref={scriptRef} className="field" rows={12} spellCheck={false} value={project.script} onChange={(e) => setScript(e.target.value)} placeholder={"Meena (happy): Hello!\nAmma: Hi Meena."} style={{ fontSize: 14.5 }} />
                <p className="hint" style={{ marginTop: 6 }}>
                  {parsed.lines.length} {parsed.lines.length === 1 ? "line" : "lines"} · about {Math.round(timeline.duration)} seconds
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select<string> ariaLabel="Add a line for" placeholder="Add a line" leading={<Plus size={16} />} search value={null} onChange={(name) => insert(`${name}: `)} options={lineOptions} />
                <Select<string> ariaLabel="Change the scene to" placeholder="Change scene" leading={<Clapperboard size={16} />} value={null} onChange={(id) => insert(`[bg: ${id}]`)} options={sceneOptions} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn" onClick={() => { setScript(SAMPLES[project.language].script); set("title", SAMPLES[project.language].title); }}>Load sample</button>
                <button type="button" className="btn" aria-expanded={ai.open} onClick={() => setAi((a) => ({ ...a, open: !a.open }))} style={{ color: "var(--accent-strong)", borderColor: "var(--accent)" }}>
                  <Sparkles size={16} /> Write with AI
                </button>
              </div>
              {parsed.notes.map((n) => <p key={n} className="note note-info">{n}</p>)}
              {ai.open && (
                <div className="card grid gap-3 p-3" style={{ background: "var(--surface-2)" }}>
                  <div>
                    <label className="lbl" htmlFor="ai-topic">What is the video about?</label>
                    <input id="ai-topic" className="field" value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} placeholder="A boy explains why he failed the exam" />
                  </div>
                  <Field label="Tone"><Select<string> ariaLabel="Tone" value={ai.tone} onChange={(v) => setAi({ ...ai, tone: v })} options={TONES} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Lines"><Select<number> ariaLabel="Number of lines" value={ai.lines} onChange={(v) => setAi({ ...ai, lines: v })} options={[4, 5, 6, 8, 10, 12, 16, 20].map((n) => ({ value: n, label: `${n} lines` }))} /></Field>
                    <Field label="People"><Select<number> ariaLabel="Number of people" value={ai.people} onChange={(v) => setAi({ ...ai, people: v })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 1 ? "1 person" : `${n} people` }))} /></Field>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={aiScript}>
                    <Sparkles size={16} /> Write it in {language.name}
                  </button>
                </div>
              )}
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
                    <span>{assets.bgImage ? "Your picture" : "Upload"}</span>
                  </button>
                </div>
                <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => { void pickBackground(e.target.files?.[0]); e.target.value = ""; }} />
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
              {project.music === "custom" && (
                <button type="button" className="btn" onClick={() => musicFileRef.current?.click()}><Upload size={16} /> {assets.music ? `${assetNames.music} — change` : "Choose an audio file"}</button>
              )}
              <div>
                <label className="lbl" htmlFor="music-vol">Music loudness · {Math.round(project.musicVolume * 100)}%</label>
                <input id="music-vol" type="range" min={0} max={1} step={0.05} value={project.musicVolume} disabled={project.music === "none"} onChange={(e) => set("musicVolume", Number(e.target.value))} />
              </div>
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
                <label className="lbl" htmlFor="key">Your key</label>
                <input id="key" className="field" style={{ fontFamily: "ui-monospace, monospace" }} type={showKey ? "text" : "password"} autoComplete="off" spellCheck={false} value={keysText} onChange={(e) => { setKeysText(e.target.value); saveKeys(e.target.value); setKeyState(null); }} placeholder="AIza…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn" onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide" : "Show"}</button>
                <button type="button" className="btn btn-teal" onClick={testKey}>Test key</button>
              </div>
              {keyState && <p className={`note ${keyState.ok ? "note-ok" : "note-error"}`} role="status">{keyState.text}</p>}
              <p className="hint">🔒 Saved only in this browser and sent only to Google. More than one key? Separate them with a comma — when one runs out, the next takes over.</p>
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
                      <p>Send this video to <a href={UTUBEFLOW_URL} target="_blank" rel="noopener noreferrer">UTubeFlow</a>, our free YouTube scheduler — no download needed. {meta ? "Your AI title and description go with it." : "Tip: make a title & tags first and they go with it."}</p>
                    </div>
                    <button type="button" className="btn btn-primary" disabled={flow.state === "opening" || flow.state === "linked"} onClick={sendToFlow}>
                      {flow.state === "opening" || flow.state === "linked" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Send to UTubeFlow
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
          <Tracks timeline={timeline} time={player.time} onSeek={player.seek} project={project} colorOf={speakerColor} characters={characters} />
        </main>
      </div>
    </div>
  );
}
