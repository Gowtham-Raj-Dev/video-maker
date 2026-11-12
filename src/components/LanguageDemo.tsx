"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildTimeline } from "@/engine/audio";
import { drawFrame, frameSize } from "@/engine/renderer";
import { LANGUAGES, defaultProject, parseScript } from "@/engine/script";
import type { LanguageId } from "@/engine/types";

const SHOWN: LanguageId[] = ["english", "tamil", "tanglish", "telugu", "hindi"];
const clock = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

/** The same sample in each language, playing (without sound) on a loop. */
export function LanguageDemo() {
  const [language, setLanguage] = useState<LanguageId>("english");
  const [shown, setShown] = useState({ t: 0, d: 1 });
  const ref = useRef<HTMLCanvasElement>(null);
  const { W, H } = frameSize("9:16");
  const K = 0.5;

  const { project, timeline } = useMemo(() => {
    const project = { ...defaultProject(language), title: "", camera: "dynamic" as const, music: "none" as const };
    return { project, timeline: buildTimeline(parseScript(project.script).lines, project, null) };
  }, [language]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const paint = (t: number) => {
      ctx.setTransform(K, 0, 0, K, 0, 0);
      drawFrame(ctx, project, timeline, t);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(1.4);
      void document.fonts.ready.then(() => paint(1.4));
      return;
    }
    let raf = 0;
    let visible = true;
    let frame = 0;
    const began = performance.now();
    const tick = () => {
      const t = ((performance.now() - began) / 1000) % timeline.duration;
      if (visible) {
        paint(t);
        if (frame++ % 6 === 0) setShown({ t, d: timeline.duration });
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

  return (
    <div className="demo">
      <div className="demo-tabs" role="group" aria-label="Sample language">
        {SHOWN.map((id) => (
          <button key={id} type="button" aria-pressed={language === id} onClick={() => setLanguage(id)}>
            {LANGUAGES.find((l) => l.id === id)?.name}
          </button>
        ))}
      </div>
      <div className="demo-frame">
        <canvas ref={ref} width={W * K} height={H * K} role="img" aria-label="Sample video: Meena and Amma talking, with captions" style={{ display: "block", width: "100%", aspectRatio: `${W} / ${H}` }} />
        <div className="demo-bar" aria-hidden="true">
          <span>{clock(shown.t)}</span>
          <i><b style={{ width: `${(shown.t / shown.d) * 100}%` }} /></i>
          <span>{clock(shown.d)}</span>
        </div>
      </div>
    </div>
  );
}
