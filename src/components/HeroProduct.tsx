"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { buildTimeline } from "@/engine/audio";
import { characterById } from "@/engine/characters";
import { drawFrame, frameSize } from "@/engine/renderer";
import { LANGUAGES, defaultProject, parseScript } from "@/engine/script";
import type { LanguageId } from "@/engine/types";

const SHOWN: LanguageId[] = ["english", "tamil", "tanglish", "telugu", "hindi"];
const COLORS = ["#FF8A5B", "#5BB8A6", "#F2C14E", "#8FA8F0"];
const clock = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

/**
 * The editor as it really works, in a window: the script on the left, the
 * actors performing it in the middle, the cast on the right. Silent, looping.
 */
export function HeroProduct() {
  const [language, setLanguage] = useState<LanguageId>("english");
  const [t, setT] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const { W, H } = frameSize("9:16");
  const K = 0.5;

  const { project, lines, timeline } = useMemo(() => {
    const project = { ...defaultProject(language), title: "", camera: "dynamic" as const, music: "none" as const };
    const lines = parseScript(project.script).lines;
    return { project, lines, timeline: buildTimeline(lines, project, null) };
  }, [language]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const paint = (at: number) => {
      ctx.setTransform(K, 0, 0, K, 0, 0);
      drawFrame(ctx, project, timeline, at);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(1.4);
      setT(1.4);
      void document.fonts.ready.then(() => paint(1.4));
      return;
    }
    let raf = 0;
    let visible = true;
    let frame = 0;
    const began = performance.now();
    const tick = () => {
      const at = ((performance.now() - began) / 1000) % timeline.duration;
      if (visible) {
        paint(at);
        if (frame++ % 4 === 0) setT(at);
      }
      raf = requestAnimationFrame(tick);
    };
    const watch = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    watch.observe(canvas);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
    };
  }, [project, timeline]);

  const color = (name: string) => COLORS[Math.max(0, project.cast.findIndex((c) => c.name === name)) % COLORS.length];
  const speaking = timeline.spans.findIndex((s) => t >= s.start - 0.2 && t <= s.end + 0.15);

  return (
    <div className="pf">
      <div className="pf-bar">
        <span className="pf-dots" aria-hidden="true"><i /><i /><i /></span>
        <div className="pf-tabs" role="group" aria-label="Sample language">
          {SHOWN.map((id) => (
            <button key={id} type="button" aria-pressed={language === id} onClick={() => setLanguage(id)}>
              {LANGUAGES.find((l) => l.id === id)?.name}
            </button>
          ))}
        </div>
        <span className="pf-url">videomaker.codelove.in/editor</span>
      </div>

      <div className="pf-body">
        <div className="pf-script" aria-label="The script">
          <p className="pf-head">Script</p>
          {lines.map((l, i) => (
            <div key={i} className="pf-line" data-on={i === speaking}>
              <span style={{ background: color(l.speaker) }}>{l.speaker}</span>
              <p>{l.caption}</p>
            </div>
          ))}
        </div>

        <div className="pf-stage">
          <canvas ref={ref} width={W * K} height={H * K} role="img" aria-label="The script being performed by two cartoon characters, with captions" />
        </div>

        <div className="pf-side">
          <p className="pf-head">Cast</p>
          {project.cast.map((m) => (
            <div key={m.name} className="pf-cast">
              <Avatar id={m.characterId} size={36} />
              <span>
                <b>{m.name}</b>
                <small>{characterById(m.characterId).name} · voice {m.voice}</small>
              </span>
            </div>
          ))}
          <p className="pf-head" style={{ marginTop: 18 }}>Video</p>
          <dl className="pf-props">
            <div><dt>Format</dt><dd>9:16 Shorts</dd></div>
            <div><dt>Captions</dt><dd>Pop · Top</dd></div>
            <div><dt>Camera</dt><dd>Follow speaker</dd></div>
            <div><dt>Quality</dt><dd>1080p · 30 fps</dd></div>
          </dl>
          <span className="pf-export"><Download size={14} /> Export MP4</span>
        </div>
      </div>

      <div className="pf-timeline" aria-hidden="true">
        <span className="pf-time">{clock(t)}</span>
        <div className="pf-track">
          {timeline.spans.map((s, i) => (
            <i key={i} style={{ left: `${(s.start / timeline.duration) * 100}%`, width: `${((s.end - s.start) / timeline.duration) * 100}%`, background: color(s.line.speaker), opacity: i === speaking ? 1 : 0.55 }} />
          ))}
          <b style={{ left: `${(t / timeline.duration) * 100}%` }} />
        </div>
        <span className="pf-time">{clock(timeline.duration)}</span>
      </div>
    </div>
  );
}
