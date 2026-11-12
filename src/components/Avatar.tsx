"use client";

import { useEffect, useRef } from "react";
import { BODY, characterById, drawCharacter, isThin } from "@/engine/characters";

/** A character's face, drawn the same way the video draws it. */
export function Avatar({ id, size = 64, tint = "#EFEDE7" }: { id: string; size?: number; tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const px = 192;
    const look = characterById(id).look;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, px, px);
    const size = look.size ?? 1;
    if (isThin(look)) {
      // Rico style: the head (radius 150) sits 830 units up.
      const k = look.hat === "chef" ? 0.33 : look.hat ? 0.37 : 0.4;
      const headY = look.hat === "chef" ? 126 : look.hat ? 116 : 108;
      drawCharacter(ctx, px / 2 - 10 * k, headY + 830 * k, look, { t: 1, mood: "happy", scale: k / size });
    } else {
      // Machan style: the head (radius 118) sits 540 units up; hats sit a little lower.
      const k = look.hat ? 0.46 : 0.52;
      const headY = look.hat === "chef" ? 132 : look.hat ? 118 : 104;
      drawCharacter(ctx, px / 2 - 12 * k, headY + 540 * k, look, { t: 1, mood: "happy", scale: k / (BODY * size) });
    }
  }, [id, tint]);
  return (
    <canvas
      ref={ref}
      width={192}
      height={192}
      aria-hidden="true"
      style={{ width: size, height: size, flex: "none", borderRadius: "50%", background: tint, boxShadow: "inset 0 0 0 1px rgba(22,21,26,0.08)" }}
    />
  );
}
