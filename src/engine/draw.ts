export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Pt = [number, number];

export const INK = "#1E1B2E";

/** The fonts the canvas writes with: a rounded display face for each script the site speaks. */
export const FONT = `"Baloo 2", "Baloo Thambi 2", "Baloo Tammudu 2", "Noto Color Emoji", "Segoe UI Emoji", "Nirmala UI", system-ui, sans-serif`;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function easeOutBack(x: number) {
  const k = clamp01(x);
  const c = 1.70158;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
}

export function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.moveTo(x + rx, y);
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

/** A filled shape with an ink outline. */
export function blob(ctx: Ctx, fill: string, path: () => void, line = 8) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = line;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

/** A round-ended line with an ink outline: limbs. */
export function stick(ctx: Ctx, pts: Pt[], color: string, width: number, line = 8) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + line * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Text with an ink outline, centred on (x, y). */
export function label(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, outline = 0, weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (outline > 0) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
