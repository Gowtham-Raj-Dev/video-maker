"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Preview } from "@/components/Preview";
import { buildTimeline } from "@/engine/audio";
import { BACKGROUNDS } from "@/engine/backgrounds";
import { CHARACTERS, VOICES, characterById } from "@/engine/characters";
import { canEncodeMp4, exportMp4, exportRecording, toSrt, type Quality } from "@/engine/export";
import { checkKey, splitKeys, withKeys, writeMeta, writeScript, type VideoMeta } from "@/engine/gemini";
import { LANGUAGES, MOODS, SAMPLES, defaultProject, parseScript, syncCast } from "@/engine/script";
import { clearVoices, loadKeys, loadProject, saveKeys, saveProject } from "@/engine/store";
import type { Format, MusicId, Project, SubtitlePosition, SubtitleStyle } from "@/engine/types";
import { recordVoices, type LineVoice } from "@/engine/voice";

type Status = { phase: "idle" } | { phase: "voice" | "video" | "writing"; note: string; share: number };

const FORMATS: Array<{ id: Format; name: string; use: string }> = [
  { id: "9:16", name: "9:16", use: "Shorts · Reels" },
  { id: "16:9", name: "16:9", use: "YouTube" },
  { id: "1:1", name: "1:1", use: "Feed post" },
];
const SUB_STYLES: Array<{ id: SubtitleStyle; name: string }> = [
  { id: "pop", name: "Pop" }, { id: "karaoke", name: "Karaoke" }, { id: "box", name: "Box" }, { id: "clean", name: "Clean" }, { id: "off", name: "Off" },
];
const SUB_POSITIONS: Array<{ id: SubtitlePosition; name: string }> = [{ id: "top", name: "Top" }, { id: "middle", name: "Middle" }, { id: "bottom", name: "Bottom" }];
const MUSIC: Array<{ id: MusicId; name: string }> = [{ id: "funny", name: "Funny tiptoe" }, { id: "chill", name: "Chill" }, { id: "suspense", name: "Suspense" }, { id: "none", name: "No music" }];
const QUALITIES: Array<{ id: Quality; name: string }> = [{ id: 720, name: "720p (fast)" }, { id: 1080, name: "1080p Full HD" }, { id: 1440, name: "1440p" }, { id: 2160, name: "4K" }];
const TONES = ["funny", "emotional", "motivational", "educational", "spooky-funny", "romantic comedy"];

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Studio() {
  const [project, setProject] = useState<Project>(() => defaultProject());
  const [loaded, setLoaded] = useState(false);
  const [keysText, setKeysText] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyState, setKeyState] = useState<{ ok: boolean; text: string } | null>(null);
  const [voiced, setVoiced] = useState<{ sig: string; voices: LineVoice[] } | null>(null);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [error, setError] = useState("");
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string; sig: string } | null>(null);
  const [quality, setQuality] = useState<Quality>(1080);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [fonts, setFonts] = useState(0);
  const [ai, setAi] = useState({ open: false, topic: "", tone: TONES[0], lines: 6, people: 2 });
  const abortRef = useRef<AbortController | null>(null);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const keyCardRef = useRef<HTMLElement>(null);

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
    const samples: Array<[string, string]> = [["Baloo 2", "Aa"], ["Baloo 2", "अ"], ["Baloo Thambi 2", "அ"], ["Baloo Tammudu 2", "అ"]];
    for (const [family, text] of samples) void document.fonts.load(`800 40px "${family}"`, text).then(() => setFonts((n) => n + 1)).catch(() => {});
  }, []);

  const parsed = useMemo(() => parseScript(project.script), [project.script]);
  const sig = useMemo(
    () => JSON.stringify([parsed.lines.map((l) => [l.speaker, l.text]), project.cast.map((c) => [c.name, c.voice])]),
    [parsed, project.cast],
  );
  const voices = voiced?.sig === sig ? voiced.voices : null;
  const timeline = useMemo(
    () => buildTimeline(parsed.lines, project, voices),
    // Only what changes the timing or the sound; looks are read at draw time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, voices, project.music, project.musicVolume, project.sfx, project.punch],
  );
  const projectSig = useMemo(() => JSON.stringify(project), [project]);
  const busy = status.phase !== "idle";
  const keys = splitKeys(keysText);

  const set = <K extends keyof Project>(key: K, value: Project[K]) => setProject((p) => ({ ...p, [key]: value }));
  const setScript = (script: string) => setProject((p) => ({ ...p, script, cast: syncCast(parseScript(script).lines, p.cast) }));

  const needKey = () => {
    setError("Add your free Gemini API key first (step 4).");
    keyCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  async function generate(fresh = false) {
    setError("");
    if (!parsed.lines.length) return setError("Write at least one line in the script, like  Meena: Hello!");
    if (!keys.length) return needKey();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      let lineVoices = fresh ? null : voices;
      if (!lineVoices) {
        setStatus({ phase: "voice", note: "Recording voices…", share: 0 });
        lineVoices = await recordVoices(parsed.lines, project.cast, keys, project.voiceMode === "line", fresh, (p) => setStatus({ phase: "voice", note: p.note || "Recording voices…", share: p.done / p.total }), abort.signal);
        setVoiced({ sig, voices: lineVoices });
      }
      const full = buildTimeline(parsed.lines, project, lineVoices);
      await renderVideo(full, abort.signal);
    } catch (e) {
      if (!isAbort(e)) setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
      abortRef.current = null;
    }
  }

  async function renderVideo(full: ReturnType<typeof buildTimeline>, signal: AbortSignal) {
    setStatus({ phase: "video", note: "Drawing the video…", share: 0 });
    const onProgress = (share: number) => setStatus({ phase: "video", note: share < 0.95 ? "Drawing the video…" : "Finishing the file…", share });
    let out;
    if (canEncodeMp4()) {
      try {
        out = await exportMp4(project, full, quality, onProgress, signal);
      } catch (e) {
        if (isAbort(e)) throw e;
        setStatus({ phase: "video", note: "Fast export isn't available here — recording as it plays…", share: 0 });
        out = await exportRecording(project, full, quality, onProgress, signal);
      }
    } else {
      setStatus({ phase: "video", note: "Recording the video as it plays (this browser has no fast export)…", share: 0 });
      out = await exportRecording(project, full, quality, onProgress, signal);
    }
    setVideo((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { url: URL.createObjectURL(out.blob), blob: out.blob, ext: out.ext, sig: projectSig };
    });
  }

  async function silentVideo() {
    setError("");
    if (!parsed.lines.length) return setError("Write at least one line in the script first.");
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await renderVideo(timeline, abort.signal);
    } catch (e) {
      if (!isAbort(e)) setError(messageOf(e));
    } finally {
      setStatus({ phase: "idle" });
      abortRef.current = null;
    }
  }

  async function aiScript() {
    setError("");
    if (!ai.topic.trim()) return setError("Tell the AI what the video is about.");
    if (!keys.length) return needKey();
    const names = [...project.cast.map((c) => c.name), ...CHARACTERS.map((c) => c.name).filter((n) => !project.cast.some((c) => c.name === n))].slice(0, ai.people);
    setStatus({ phase: "writing", note: "Gemini is writing your script…", share: 0.5 });
    try {
      const script = await withKeys(keys, (key) => writeScript(key, { topic: ai.topic.trim(), language: project.language, tone: ai.tone, lines: ai.lines, names, backgrounds: BACKGROUNDS.slice(0, 12).map((b) => b.id) }));
      setScript(script);
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
      const language = LANGUAGES.find((l) => l.id === project.language)?.name ?? "English";
      setMeta(await withKeys(keys, (key) => writeMeta(key, project.script, language)));
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
      setKeyState({ ok: true, text: keys.length > 1 ? `All ${keys.length} keys work.` : "This key works. You're ready to make videos." });
    } catch (e) {
      setKeyState({ ok: false, text: messageOf(e) });
    }
  }

  const addLineFor = (name: string) => {
    setScript(`${project.script.replace(/\s+$/, "")}\n${name}: `);
    requestAnimationFrame(() => {
      const el = scriptRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollTop = el.scrollHeight;
    });
  };

  const fileName = (project.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "cartoon-video").toLowerCase();
  const language = LANGUAGES.find((l) => l.id === project.language)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
      <div className="grid gap-6">
        {/* 1 · Script */}
        <section className="card p-4 sm:p-6" aria-labelledby="s-script">
          <div className="mb-4 flex items-center gap-3">
            <span className="step">1</span>
            <h2 id="s-script" className="text-2xl">Write the script</h2>
          </div>
          <span className="lbl">Language</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" className="chip" aria-pressed={project.language === l.id} onClick={() => set("language", l.id)} title={l.native}>
                {l.name}
              </button>
            ))}
          </div>
          <p className="hint mb-3">{language.hint}</p>

          <label className="lbl" htmlFor="script">Script — one line per turn:  Name (mood): words</label>
          <textarea
            id="script"
            ref={scriptRef}
            className="field"
            rows={9}
            spellCheck={false}
            value={project.script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={"Meena (happy): Hello!\nAmma: Hi Meena."}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="hint" style={{ fontWeight: 700 }}>
              {parsed.lines.length} {parsed.lines.length === 1 ? "line" : "lines"} · about {Math.round(timeline.duration)} s
            </span>
            <span className="grow" />
            <button type="button" className="btn btn-small" onClick={() => { setScript(SAMPLES[project.language].script); set("title", SAMPLES[project.language].title); }}>
              Load {language.name} sample
            </button>
            <button type="button" className="btn btn-small btn-violet" aria-expanded={ai.open} onClick={() => setAi((a) => ({ ...a, open: !a.open }))}>
              ✨ Write with AI
            </button>
          </div>
          {parsed.notes.map((n) => <p key={n} className="note note-info mt-2">{n}</p>)}

          {ai.open && (
            <div className="note note-info mt-3 grid gap-3">
              <div>
                <label className="lbl" htmlFor="ai-topic">What is the video about?</label>
                <input id="ai-topic" className="field" value={ai.topic} onChange={(e) => setAi({ ...ai, topic: e.target.value })} placeholder="A boy explains to his mom why he failed the exam" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="lbl" htmlFor="ai-tone">Tone</label>
                  <select id="ai-tone" className="field" value={ai.tone} onChange={(e) => setAi({ ...ai, tone: e.target.value })}>
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="ai-lines">Lines</label>
                  <select id="ai-lines" className="field" value={ai.lines} onChange={(e) => setAi({ ...ai, lines: Number(e.target.value) })}>
                    {[4, 5, 6, 8, 10, 12, 16].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="ai-people">People</label>
                  <select id="ai-people" className="field" value={ai.people} onChange={(e) => setAi({ ...ai, people: Number(e.target.value) })}>
                    {[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-violet" disabled={busy} onClick={aiScript}>
                {status.phase === "writing" ? "Writing…" : `✨ Write the script in ${language.name}`}
              </button>
            </div>
          )}

          <details className="mt-3">
            <summary className="hint" style={{ fontWeight: 700 }}>▸ Script tricks (moods, backgrounds, separate subtitles)</summary>
            <ul className="hint mt-2 grid gap-1 pl-5" style={{ listStyle: "disc" }}>
              <li><b>Moods:</b> <code>Meena (angry): …</code> — {MOODS.join(", ")}.</li>
              <li><b>Change the place</b> mid-video: a line with <code>[bg: park]</code> — {BACKGROUNDS.slice(0, 12).map((b) => b.id).join(", ")}.</li>
              <li><b>Different subtitle</b> from the voice: <code>Name: spoken words | subtitle words</code> (Tamil voice, Tanglish subtitle).</li>
              <li>Any name works — each new name gets its own character in step 2. The last line is treated as the punch line.</li>
            </ul>
          </details>
        </section>

        {/* 2 · Cast */}
        <section className="card p-4 sm:p-6" aria-labelledby="s-cast">
          <div className="mb-4 flex items-center gap-3">
            <span className="step">2</span>
            <h2 id="s-cast" className="text-2xl">Pick the cast</h2>
          </div>
          {project.cast.length === 0 && <p className="hint">Names from your script appear here.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {project.cast.map((member, i) => (
              <div key={member.name} className="flex items-center gap-3 rounded-2xl border-[2.5px] border-[color:var(--ink)] p-3" style={{ background: "var(--paper)" }}>
                <Avatar id={member.characterId} size={68} tint={["#FFD166", "#C9F7E8", "#FFAFCC", "#E8E3FF", "#8ECAE6"][i % 5]} />
                <div className="grid min-w-0 grow gap-2">
                  <strong className="display truncate text-lg">{member.name}</strong>
                  <select
                    className="field"
                    style={{ minHeight: 38, padding: "4px 8px" }}
                    aria-label={`Character for ${member.name}`}
                    value={member.characterId}
                    onChange={(e) => {
                      const pick = characterById(e.target.value);
                      set("cast", project.cast.map((c) => (c.name === member.name ? { ...c, characterId: pick.id, voice: pick.voice } : c)));
                    }}
                  >
                    {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.blurb}</option>)}
                  </select>
                  <select
                    className="field"
                    style={{ minHeight: 38, padding: "4px 8px" }}
                    aria-label={`Voice for ${member.name}`}
                    value={member.voice}
                    onChange={(e) => set("cast", project.cast.map((c) => (c.name === member.name ? { ...c, voice: e.target.value } : c)))}
                  >
                    <optgroup label="Female voices">
                      {VOICES.filter((v) => v.kind === "F").map((v) => <option key={v.name} value={v.name}>🎙 {v.name} · {v.tone}</option>)}
                    </optgroup>
                    <optgroup label="Male voices">
                      {VOICES.filter((v) => v.kind === "M").map((v) => <option key={v.name} value={v.name}>🎙 {v.name} · {v.tone}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <span className="lbl mt-5">All {CHARACTERS.length} characters — tap one to add a line for them</span>
          <div className="flex flex-wrap gap-2">
            {CHARACTERS.map((c) => (
              <button key={c.id} type="button" className="chip" style={{ padding: "3px 12px 3px 3px" }} onClick={() => addLineFor(c.name)} title={c.blurb}>
                <Avatar id={c.id} size={34} />
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* 3 · Look */}
        <section className="card p-4 sm:p-6" aria-labelledby="s-look">
          <div className="mb-4 flex items-center gap-3">
            <span className="step">3</span>
            <h2 id="s-look" className="text-2xl">Scene, subtitles &amp; sound</h2>
          </div>

          <span className="lbl">Video shape</span>
          <div className="mb-4 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={project.format === f.id} onClick={() => set("format", f.id)}>
                {f.name} <span style={{ opacity: 0.7, fontWeight: 600 }}>{f.use}</span>
              </button>
            ))}
          </div>

          <span className="lbl">Background</span>
          <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className="swatch"
                aria-pressed={project.background === b.id}
                aria-label={b.name}
                title={b.name}
                onClick={() => set("background", b.id)}
                style={{ background: `linear-gradient(${b.swatch[0]} 0 66%, ${b.swatch[1]} 66%)` }}
              >
                <span>{b.name}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="lbl">Subtitle style</span>
              <div className="flex flex-wrap gap-2">
                {SUB_STYLES.map((s) => (
                  <button key={s.id} type="button" className="chip" aria-pressed={project.subtitleStyle === s.id} onClick={() => set("subtitleStyle", s.id)}>{s.name}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="lbl">Subtitle place</span>
              <div className="flex flex-wrap gap-2">
                {SUB_POSITIONS.map((s) => (
                  <button key={s.id} type="button" className="chip" aria-pressed={project.subtitlePosition === s.id} onClick={() => set("subtitlePosition", s.id)}>{s.name}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="lbl" htmlFor="sub-size">Subtitle size · {Math.round(project.subtitleSize * 100)}%</label>
              <input id="sub-size" type="range" min={0.7} max={1.4} step={0.05} value={project.subtitleSize} onChange={(e) => set("subtitleSize", Number(e.target.value))} />
            </div>
            <div>
              <label className="lbl" htmlFor="music">Music</label>
              <select id="music" className="field" value={project.music} onChange={(e) => set("music", e.target.value as MusicId)}>
                {MUSIC.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="title">Title on the video (optional)</label>
              <input id="title" className="field" value={project.title} onChange={(e) => set("title", e.target.value)} placeholder="Wait for the last line 😂" maxLength={80} />
            </div>
            <div>
              <label className="lbl" htmlFor="handle">Channel name / watermark (optional)</label>
              <input id="handle" className="field" value={project.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@YourChannel" maxLength={40} />
            </div>
            <div>
              <label className="lbl" htmlFor="music-vol">Music loudness · {Math.round(project.musicVolume * 100)}%</label>
              <input id="music-vol" type="range" min={0} max={1} step={0.05} value={project.musicVolume} disabled={project.music === "none"} onChange={(e) => set("musicVolume", Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              {([["showNames", "Name tags under the characters"], ["punch", "Punch-line ending (zoom, laughs, reaction)"], ["sfx", "Sound effects"]] as const).map(([key, text]) => (
                <label key={key} className="flex items-center gap-2" style={{ fontWeight: 700, minHeight: 32 }}>
                  <input type="checkbox" className="tick" checked={project[key]} onChange={(e) => set(key, e.target.checked)} />
                  {text}
                </label>
              ))}
            </div>
          </div>
          {!voices && project.music !== "none" && <p className="hint mt-3">Music and sound effects are heard once the voices are recorded.</p>}
        </section>

        {/* 4 · Key */}
        <section ref={keyCardRef} className="card p-4 sm:p-6" aria-labelledby="s-key" id="api-key">
          <div className="mb-4 flex items-center gap-3">
            <span className="step">4</span>
            <h2 id="s-key" className="text-2xl">Your Gemini API key</h2>
          </div>
          <p className="mb-3">
            The voices are made by Google&apos;s Gemini with <b>your own free key</b>.{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: "#5a3fe0" }}>Get a key from Google AI Studio ↗</a>{" "}
            (1 minute, no card).
          </p>
          <label className="lbl" htmlFor="key">API key</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="key"
              className="field"
              style={{ flex: "1 1 240px", width: "auto", fontFamily: "ui-monospace, monospace" }}
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={keysText}
              onChange={(e) => { setKeysText(e.target.value); saveKeys(e.target.value); setKeyState(null); }}
              placeholder="AIza…"
            />
            <button type="button" className="btn" onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide" : "Show"}</button>
            <button type="button" className="btn btn-mint" onClick={testKey}>Test key</button>
          </div>
          {keyState && <p className={`note mt-2 ${keyState.ok ? "note-ok" : "note-error"}`} role="status">{keyState.text}</p>}
          <p className="hint mt-2">🔒 Saved only in this browser and sent only to Google. More than one key? Separate them with a comma — when one runs out, the next takes over.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="lbl" htmlFor="voice-mode">Voice recording</label>
              <select id="voice-mode" className="field" value={project.voiceMode} onChange={(e) => set("voiceMode", e.target.value as Project["voiceMode"])}>
                <option value="batch">Conversation (fewer requests, natural)</option>
                <option value="line">Line by line (uses more of your limit)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" className="btn" onClick={() => { void clearVoices(); setVoiced(null); }}>Forget recorded voices</button>
            </div>
          </div>
        </section>
      </div>

      {/* Preview and export */}
      <aside className="grid gap-4 lg:sticky lg:top-[84px]" aria-label="Preview and download">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xl">Preview</h2>
            <span className="burst" style={{ fontSize: 13, background: voices ? "var(--mint)" : "var(--yellow)" }}>{voices ? "With voice 🎙" : "Silent draft"}</span>
          </div>
          <Preview project={project} timeline={timeline} redraw={fonts} />
        </div>

        <div className="card grid gap-3 p-4">
          <div>
            <label className="lbl" htmlFor="quality">Video quality</label>
            <select id="quality" className="field" value={quality} onChange={(e) => setQuality(Number(e.target.value) as Quality)}>
              {QUALITIES.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </div>

          {busy ? (
            <div className="grid gap-2" role="status" aria-live="polite">
              <strong>{status.note}</strong>
              <div className="bar"><i style={{ width: `${Math.round(status.share * 100)}%` }} /></div>
              {status.phase !== "writing" && <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>}
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-big" onClick={() => generate()}>
              🎬 {voices ? "Make the video" : "Record voices & make video"}
            </button>
          )}

          {error && <p className="note note-error" role="alert">{error}</p>}

          {video && !busy && (
            <div className="grid gap-3">
              {video.sig !== projectSig && <p className="note note-info">You changed something since this video was made — press the red button to make it again.</p>}
              <video src={video.url} controls playsInline style={{ width: "100%", maxHeight: 320, borderRadius: 14, border: "3px solid var(--ink)", background: "#000" }} />
              <button type="button" className="btn btn-mint btn-big" onClick={() => download(video.blob, `${fileName}.${video.ext}`)}>
                ⬇ Download {video.ext.toUpperCase()} · {(video.blob.size / 1_048_576).toFixed(1)} MB
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-small" onClick={() => download(new Blob([toSrt(timeline)], { type: "text/plain" }), `${fileName}.srt`)}>Subtitles (.srt)</button>
                <button type="button" className="btn btn-small btn-violet" onClick={aiMeta}>✨ YouTube title &amp; tags</button>
                <button type="button" className="btn btn-small" onClick={() => generate(true)}>Re-record voices</button>
              </div>
            </div>
          )}

          {meta && (
            <div className="grid gap-2">
              {([["Title", meta.title], ["Description", meta.description], ["Tags", meta.tags.join(", ")]] as const).map(([name, text]) => (
                <div key={name}>
                  <div className="flex items-center justify-between">
                    <span className="lbl" style={{ margin: 0 }}>{name}</span>
                    <button type="button" className="btn btn-small" onClick={() => void navigator.clipboard?.writeText(text)}>Copy</button>
                  </div>
                  <p className="note mt-1" style={{ whiteSpace: "pre-wrap", fontWeight: 600, fontSize: 14, maxHeight: 160, overflow: "auto" }}>{text}</p>
                </div>
              ))}
            </div>
          )}

          {!busy && !voices && (
            <button type="button" className="hint" style={{ background: "none", border: 0, textDecoration: "underline", cursor: "pointer", minHeight: 32 }} onClick={silentVideo}>
              No key yet? Download a silent test video
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
