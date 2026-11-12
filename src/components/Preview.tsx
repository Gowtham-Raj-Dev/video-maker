"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawFrame, frameSize } from "@/engine/renderer";
import { MIX_RATE, type Project, type Timeline } from "@/engine/types";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The video, live: plays the timeline on a canvas with its sound. */
export function Preview({ project, timeline, redraw }: { project: Project; timeline: Timeline; redraw: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startRef = useRef({ clock: 0, from: 0 });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const { W, H } = frameSize(project.format);
  const K = 2 / 3;

  const paint = useCallback(
    (t: number) => {
      const ctx = canvasRef.current?.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.setTransform(K, 0, 0, K, 0, 0);
      drawFrame(ctx, project, timeline, t);
    },
    [project, timeline, K],
  );

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  // A new timeline (new script, new voices): back to the start.
  useEffect(() => {
    stop();
    setTime((t) => Math.min(t, timeline.duration));
  }, [timeline, stop]);

  useEffect(() => {
    if (!playing) paint(time);
  }, [paint, time, playing, redraw]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      const t = startRef.current.from + (audio ? audio.currentTime - startRef.current.clock : 0);
      if (t >= timeline.duration) {
        setTime(timeline.duration);
        stop();
        return;
      }
      paint(t);
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, paint, timeline.duration, stop]);

  useEffect(() => () => void audioRef.current?.close(), []);

  const play = () => {
    const audio = (audioRef.current ??= new AudioContext());
    void audio.resume();
    const from = time >= timeline.duration - 0.05 ? 0 : time;
    if (timeline.audio) {
      const buffer = audio.createBuffer(1, timeline.audio.length, MIX_RATE);
      buffer.getChannelData(0).set(timeline.audio);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start(0, from);
      sourceRef.current = source;
    }
    startRef.current = { clock: audio.currentTime, from };
    setPlaying(true);
  };

  return (
    <div>
      <div className="stage mx-auto" style={{ maxWidth: `calc(62vh * ${W / H})`, minWidth: 220 }}>
        <canvas
          ref={canvasRef}
          width={Math.round(W * K)}
          height={Math.round(H * K)}
          style={{ display: "block", width: "100%", aspectRatio: `${W} / ${H}`, cursor: "pointer" }}
          onClick={() => (playing ? stop() : play())}
          aria-label="Video preview. Press to play or pause."
          role="img"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn btn-yellow" style={{ minWidth: 104 }} onClick={() => (playing ? stop() : play())}>
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <input
          type="range"
          min={0}
          max={timeline.duration}
          step={0.01}
          value={Math.min(time, timeline.duration)}
          onChange={(e) => {
            stop();
            setTime(Number(e.target.value));
          }}
          aria-label="Seek"
        />
        <span className="hint" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 700 }}>
          {clock(time)} / {clock(timeline.duration)}
        </span>
      </div>
    </div>
  );
}
