"use client";

import { useEffect, useRef } from "react";
import { BODY, characterById, drawCharacter, isThin } from "@/engine/characters";

/** A character standing, head to shoes, drawn the way the video draws them. */
export function Figure({ id, height = 150 }: { id: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const W = 240;
    const H = 300;
    const look = characterById(id).look;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Grown-ups' heads reach the same line (a chef's hat just fits); children stand smaller, as in the video.
    const scale = isThin(look) ? 0.245 : 0.355 / BODY;
    drawCharacter(ctx, W / 2 - 6, H - 10, look, { t: 1.3, mood: "happy", scale, arm: "down" });
  }, [id]);
  return <canvas ref={ref} width={240} height={300} aria-hidden="true" style={{ display: "block", height, width: (height * 240) / 300 }} />;
}
