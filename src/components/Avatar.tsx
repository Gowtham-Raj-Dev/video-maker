"use client";

import { useEffect, useRef } from "react";
import { characterById, drawCharacter } from "@/engine/characters";

/** A character's face, drawn the same way the video draws it. */
export function Avatar({ id, size = 64, tint = "#FFEFC7" }: { id: string; size?: number; tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const px = 192;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, px, px);
    const s = 0.4;
    drawCharacter(ctx, px / 2 - 10 * s, 108 + 830 * s, characterById(id).look, { t: 1, mood: "happy", scale: s });
  }, [id, tint]);
  return (
    <canvas
      ref={ref}
      width={192}
      height={192}
      aria-hidden="true"
      style={{ width: size, height: size, flex: "none", borderRadius: "50%", border: "2.5px solid var(--ink)", background: tint }}
    />
  );
}
