"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawFrame, frameSize } from "@/engine/renderer";
import { MIX_RATE, type Assets, type Project, type Timeline } from "@/engine/types";

/** How sharp the preview canvas is, against the video's full frame. */
const K = 2 / 3;

/** Plays a timeline on a canvas with its sound; the editor's stage, transport and timeline all hang off this. */
export function usePlayer(project: Project, timeline: Timeline, assets: Assets | null, redraw: number, loop = false) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startRef = useRef({ clock: 0, from: 0 });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const { W, H } = frameSize(project.format);

  const paint = useCallback(
    (t: number) => {
      const ctx = canvasRef.current?.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.setTransform(K, 0, 0, K, 0, 0);
      drawFrame(ctx, project, timeline, t, assets);
    },
    [project, timeline, assets],
  );

  const silence = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped.
    }
    sourceRef.current = null;
  }, []);

  const stop = useCallback(() => {
    silence();
    setPlaying(false);
  }, [silence]);

  const start = useCallback(
    (from: number) => {
      silence();
      const audio = (audioRef.current ??= new AudioContext());
      void audio.resume();
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
    },
    [timeline, silence],
  );

  const play = useCallback(() => start(time >= timeline.duration - 0.05 ? 0 : time), [start, time, timeline.duration]);
  const toggle = useCallback(() => (playing ? stop() : play()), [playing, stop, play]);
  const seek = useCallback(
    (t: number) => {
      stop();
      setTime(Math.max(0, Math.min(timeline.duration, t)));
    },
    [stop, timeline.duration],
  );

  // A new timeline (new script, new voices): stop, and stay inside it.
  useEffect(() => {
    stop();
    setTime((t) => Math.min(t, timeline.duration));
  }, [timeline, stop]);

  useEffect(() => {
    if (!playing) paint(time);
  }, [paint, time, playing, redraw, W, H]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      const t = startRef.current.from + (audio ? audio.currentTime - startRef.current.clock : 0);
      if (t >= timeline.duration) {
        if (loop) {
          start(0);
          return;
        }
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
  }, [playing, paint, timeline.duration, stop, start, loop]);

  useEffect(() => () => void audioRef.current?.close(), []);

  /** Opens the sound while the visitor is clicking, so sound started later (after recording) is allowed to play. */
  const prime = useCallback(() => {
    const audio = (audioRef.current ??= new AudioContext());
    void audio.resume();
  }, []);

  return { canvasRef, width: Math.round(W * K), height: Math.round(H * K), playing, time, play, playFrom: start, prime, stop, toggle, seek };
}
