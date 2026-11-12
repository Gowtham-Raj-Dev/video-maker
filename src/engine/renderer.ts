import { backgroundById } from "./backgrounds";
import { characterById, drawCharacter } from "./characters";
import { FONT, INK, blob, clamp01, easeOutBack, label, type Ctx } from "./draw";
import { ENVELOPE_RATE, type Arm, type CastMember, type Format, type Line, type Mood, type Project, type Span, type Timeline } from "./types";

interface Layout {
  W: number;
  H: number;
  floor: number;
  /** The people's scale. */
  cs: number;
  /** How far the two people stand from the middle, as a share of the width. */
  spread: number;
  subSize: number;
  subY: { top: number; middle: number; bottom: number };
  titleY: number;
  titleSize: number;
}

const LAYOUTS: Record<Format, Layout> = {
  "9:16": { W: 1080, H: 1920, floor: 1536, cs: 0.72, spread: 0.22, subSize: 70, subY: { top: 330, middle: 960, bottom: 1730 }, titleY: 150, titleSize: 54 },
  "16:9": { W: 1920, H: 1080, floor: 940, cs: 0.6, spread: 0.17, subSize: 56, subY: { top: 170, middle: 540, bottom: 1032 }, titleY: 62, titleSize: 40 },
  "1:1": { W: 1080, H: 1080, floor: 930, cs: 0.56, spread: 0.22, subSize: 54, subY: { top: 190, middle: 540, bottom: 1032 }, titleY: 66, titleSize: 40 },
};

export const frameSize = (format: Format) => ({ W: LAYOUTS[format].W, H: LAYOUTS[format].H });

/** The mood a line's words suggest, when the script doesn't say. */
function moodOf(line: Line, punch: boolean): Mood {
  if (line.mood) return line.mood;
  const text = line.text + line.caption;
  if (/😭|😢|🥺/u.test(text)) return "sad";
  if (/😡|🤬/u.test(text)) return "angry";
  if (/😱|😳|🤯/u.test(text)) return "shocked";
  if (/😴|💤/u.test(text)) return "sleep";
  if (punch) return "proud";
  if (/[?？]\s*$/u.test(line.text)) return "normal";
  if (/!/.test(line.text)) return "happy";
  return "normal";
}

function armOf(mood: Mood, line: Line, index: number, into: number): Arm {
  switch (mood) {
    case "happy": return into < 0.8 ? "up" : "clasp";
    case "shocked": return "up";
    case "proud":
    case "angry": return "point";
    case "sad":
    case "sleep":
    case "deadpan": return "down";
    default: return /[?？]\s*$/u.test(line.text) ? "hold" : index % 2 ? "hold" : "point";
  }
}

interface Seat {
  name: string;
  /** Where they stand, as a share of the width. */
  x: number;
}

const stagingCache = new WeakMap<Timeline, Seat[][]>();

/**
 * Who is on screen for each line. Up to three people all stay on; with more,
 * it is a two-shot: whoever speaks and whoever they are talking to.
 */
function stagingOf(timeline: Timeline, spread: number): Seat[][] {
  const hit = stagingCache.get(timeline);
  if (hit) return hit;
  const speakers = timeline.spans.map((s) => s.line.speaker);
  const names = [...new Set(speakers)];
  let staging: Seat[][];
  if (names.length <= 3) {
    const xs = names.length === 1 ? [0.5] : names.length === 2 ? [0.5 - spread, 0.5 + spread] : [0.5 - spread - 0.08, 0.5, 0.5 + spread + 0.08];
    const seats = names.map((name, i) => ({ name, x: xs[i] }));
    staging = speakers.map(() => seats);
  } else {
    let left: string | null = null;
    let right: string | null = null;
    staging = speakers.map((speaker, i) => {
      if (speaker !== left && speaker !== right) {
        if (!left) left = speaker;
        else if (!right) right = speaker;
        else if (speakers[i - 1] === left) right = speaker;
        else left = speaker;
      }
      // An empty side takes whoever speaks next, so nobody talks to thin air.
      if (!left || !right) {
        const next = speakers.slice(i + 1).find((s) => s !== speaker) ?? null;
        if (!left) left = next;
        else right = next;
      }
      const seats: Seat[] = [];
      if (left) seats.push({ name: left, x: right ? 0.5 - spread : 0.5 });
      if (right) seats.push({ name: right, x: 0.5 + spread });
      return seats;
    });
  }
  stagingCache.set(timeline, staging);
  return staging;
}

const sample = (values: Float32Array, seconds: number) => values[Math.max(0, Math.min(values.length - 1, Math.round(seconds * ENVELOPE_RATE)))] ?? 0;

/** One frame of the video at time `t`, on a context already scaled to the frame's W × H. */
export function drawFrame(ctx: Ctx, project: Project, timeline: Timeline, t: number) {
  const L = LAYOUTS[project.format];
  const { W, H, floor } = L;
  const spans = timeline.spans;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (!spans.length) {
    backgroundById(project.background).draw(ctx, { W, H, floor, u: L.cs / 0.72, t });
    ctx.restore();
    return;
  }

  // The line on screen: it comes on a moment before it is spoken.
  let cur = 0;
  for (let i = 0; i < spans.length; i++) if (t >= spans[i].start - 0.2) cur = i;
  const span = spans[cur];
  const lastIndex = spans.length - 1;
  const punch = project.punch && spans.length > 1;
  const speaking = t >= span.start && t <= span.end;
  const afterPunch = punch && t > spans[lastIndex].end + 0.25;
  const staging = stagingOf(timeline, L.spread);
  const seats = staging[cur];
  const crowd = seats.length >= 3 ? 0.86 : 1;
  const cs = L.cs * crowd;
  const u = L.cs / 0.72;

  let bg = project.background;
  for (let i = 0; i <= cur; i++) bg = spans[i].line.bg ?? bg;

  // The camera: a slow breath, and a push in on the punch line.
  const kick = punch && t >= spans[lastIndex].start ? Math.exp(-(t - spans[lastIndex].start) * 2.2) : 0;
  const zoom = 1 + 0.012 * Math.sin(t * 0.7) + 0.07 * kick;
  ctx.save();
  ctx.translate(W / 2, floor - 320 * u);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -(floor - 320 * u));
  backgroundById(bg).draw(ctx, { W, H, floor, u, t });

  const speakerSeat = seats.find((s) => s.name === span.line.speaker);
  const speakerMood = moodOf(span.line, punch && cur === lastIndex);
  const cast = new Map(project.cast.map((c) => [c.name, c]));
  let listener = 0;
  for (const seat of seats) {
    const member: CastMember | undefined = cast.get(seat.name);
    const look = characterById(member?.characterId ?? "meena").look;
    const isSpeaker = seat === speakerSeat;
    // Everyone looks at whoever is speaking; the speaker looks at whoever spoke before.
    let target = speakerSeat?.x ?? 0.5;
    if (isSpeaker) {
      const before = [...spans.slice(0, cur)].reverse().find((s) => s.line.speaker !== seat.name && seats.some((x) => x.name === s.line.speaker));
      const other = seats.find((s) => s.name === before?.line.speaker) ?? seats.find((s) => s !== seat);
      target = other?.x ?? 1;
    }
    const face = target >= seat.x ? 1 : -1;
    const into = t - span.start;
    let mood: Mood = "normal";
    let arm: Arm = "down";
    let jump = 0;
    if (isSpeaker) {
      mood = speakerMood;
      arm = speaking || into < 0 ? armOf(mood, span.line, cur, into) : "down";
      if ((mood === "happy" || mood === "shocked") && into > 0 && into < 0.45) jump = Math.abs(Math.sin(into * 7)) * 18;
    } else {
      if (afterPunch) {
        mood = "deadpan";
        arm = listener === 0 && t > spans[lastIndex].end + 0.6 ? "facepalm" : "down";
      } else if (speakerMood === "angry") mood = "sad";
      else if (speakerMood === "happy" && speaking) mood = "happy";
      listener++;
    }
    // Someone new walks on with a pop.
    const isNew = cur > 0 && !staging[cur - 1].some((s) => s.name === seat.name);
    const enter = isNew ? easeOutBack((t - (span.start - 0.2)) / 0.3) : 1;
    if (enter <= 0.02) continue;
    drawCharacter(ctx, seat.x * W, floor, look, {
      t,
      talk: isSpeaker && speaking ? sample(span.envelope, into) : 0,
      shape: isSpeaker && speaking ? sample(span.shape, into) : 0.5,
      mood,
      face,
      arm,
      jump,
      scale: cs * enter,
    });
    if (project.showNames) nameTag(ctx, seat.name, seat.x * W, floor + 52 * u, 30 * u, isSpeaker && speaking);
  }
  ctx.restore();

  // Laughs floating up once the punch has landed.
  if (afterPunch) {
    const since = t - spans[lastIndex].end - 0.25;
    for (let k = 0; k < 5; k++) {
      const born = k * 0.14;
      if (since < born) continue;
      const age = since - born;
      const x = W * [0.13, 0.87, 0.3, 0.72, 0.5][k];
      const y = floor - [760, 820, 900, 880, 940][k] * u - age * 70 * u;
      ctx.save();
      ctx.globalAlpha = clamp01(1.6 - age * 0.9);
      ctx.translate(x, y);
      ctx.rotate(Math.sin(age * 3 + k) * 0.2);
      const pop = easeOutBack(age / 0.25);
      ctx.scale(pop, pop);
      label(ctx, "😂", 0, 0, 104 * u, "#fff");
      ctx.restore();
    }
  }

  if (project.subtitleStyle !== "off") drawSubtitle(ctx, L, project, spans, cur, t);
  if (project.title.trim()) drawTitle(ctx, L, project.title.trim());
  if (project.handle.trim()) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    label(ctx, project.handle.trim(), W / 2, H - 34 * u - (project.format === "9:16" ? 30 : 0), 30 * u, "#fff", 7 * u, 700);
    ctx.restore();
  }
  ctx.restore();
}

function nameTag(ctx: Ctx, name: string, x: number, y: number, size: number, active: boolean) {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(name).width + size * 1.2;
  blob(ctx, active ? "#FFD166" : "#FFFFFF", () => ctx.roundRect(x - w / 2, y - size * 0.8, w, size * 1.6, size * 0.8), 5);
  label(ctx, name, x, y + size * 0.04, size, INK);
}

function drawTitle(ctx: Ctx, L: Layout, title: string) {
  let size = L.titleSize;
  const max = L.W * 0.9 - size * 1.6;
  ctx.font = `800 ${size}px ${FONT}`;
  let w = ctx.measureText(title).width;
  if (w > max) {
    size = Math.max(L.titleSize * 0.55, (size * max) / w);
    ctx.font = `800 ${size}px ${FONT}`;
    w = Math.min(max, ctx.measureText(title).width);
  }
  const bw = w + size * 1.6;
  const bh = size * 1.9;
  const x = L.W / 2 - bw / 2;
  const y = L.titleY - bh / 2;
  blob(ctx, INK, () => ctx.roundRect(x + 6, y + 8, bw, bh, bh / 2), 0);
  blob(ctx, "#FFD166", () => ctx.roundRect(x, y, bw, bh, bh / 2), 7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + size * 0.5, y, bw - size, bh);
  ctx.clip();
  label(ctx, title, L.W / 2, L.titleY + size * 0.05, size, INK);
  ctx.restore();
}

interface Word {
  text: string;
  w: number;
  index: number;
}

function wrap(ctx: Ctx, words: string[], size: number, max: number): Array<{ words: Word[]; width: number }> {
  ctx.font = `800 ${size}px ${FONT}`;
  const space = size * 0.34;
  const rows: Array<{ words: Word[]; width: number }> = [{ words: [], width: 0 }];
  words.forEach((text, index) => {
    const w = ctx.measureText(text).width;
    let row = rows[rows.length - 1];
    if (row.words.length && row.width + space + w > max) {
      row = { words: [], width: 0 };
      rows.push(row);
    }
    row.width += (row.words.length ? space : 0) + w;
    row.words.push({ text, w, index });
  });
  return rows;
}

function drawSubtitle(ctx: Ctx, L: Layout, project: Project, spans: Span[], cur: number, t: number) {
  const span = spans[cur];
  const words = span.line.caption.split(/\s+/).filter(Boolean);
  if (!words.length || t < span.start - 0.15) return;
  const style = project.subtitleStyle;
  const max = L.W * 0.86;
  let size = L.subSize * project.subtitleSize * (project.punch && cur === spans.length - 1 && spans.length > 1 ? 1.08 : 1);
  let rows = wrap(ctx, words, size, max);
  for (let k = 0; k < 4 && rows.length > 3; k++) {
    size *= 0.86;
    rows = wrap(ctx, words, size, max);
  }
  const lineH = size * 1.28;
  const blockH = rows.length * lineH;
  const anchor = L.subY[project.subtitlePosition];
  const top = project.subtitlePosition === "top" ? anchor - lineH / 2 : project.subtitlePosition === "bottom" ? anchor - blockH + lineH / 2 : anchor - blockH / 2;

  // The word being said now: words take time in proportion to their length.
  const weights = words.map((w) => w.length + 2 + (/[,.!?…।]$/u.test(w) ? 3 : 0));
  const total = weights.reduce((s, x) => s + x, 0);
  const progress = (t - span.start) / (span.end - span.start);
  let active = -1;
  if (progress >= 1) active = words.length;
  else if (progress >= 0) {
    let acc = 0;
    active = words.length - 1;
    for (let i = 0; i < words.length; i++) {
      acc += weights[i];
      if (acc / total > progress) {
        active = i;
        break;
      }
    }
  }

  const appear = easeOutBack((t - (span.start - 0.15)) / 0.22);
  ctx.save();
  ctx.translate(L.W / 2, top + blockH / 2);
  ctx.scale(0.6 + 0.4 * appear, 0.6 + 0.4 * appear);
  ctx.globalAlpha = clamp01((t - (span.start - 0.15)) / 0.1);
  ctx.translate(-L.W / 2, -(top + blockH / 2));

  if (style === "box") {
    const bw = Math.max(...rows.map((r) => r.width)) + size * 1.1;
    blob(ctx, "rgba(30,27,46,0.88)", () => ctx.roundRect(L.W / 2 - bw / 2, top - size * 0.3, bw, blockH + size * 0.6, size * 0.5), 0);
  }
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const space = size * 0.34;
  rows.forEach((row, r) => {
    let x = L.W / 2 - row.width / 2;
    const y = top + lineH * (r + 0.5);
    for (const word of row.words) {
      const isActive = word.index === active;
      const spoken = word.index < active;
      let fill = "#FFFFFF";
      let alpha = 1;
      if (style === "pop" && isActive) fill = "#FFD166";
      if (style === "box" && isActive) fill = "#80ED99";
      if (style === "karaoke") {
        fill = spoken || isActive ? "#FFD166" : "#FFFFFF";
        alpha = spoken || isActive ? 1 : 0.6;
      }
      ctx.save();
      ctx.translate(x + word.w / 2, y);
      if (isActive && style !== "clean") {
        ctx.translate(0, -size * 0.05);
        ctx.scale(1.1, 1.1);
      }
      if (style !== "box") {
        ctx.strokeStyle = INK;
        ctx.lineWidth = size * (style === "clean" ? 0.14 : 0.24);
        ctx.strokeText(word.text, 0, 0);
      }
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.fillText(word.text, 0, 0);
      ctx.restore();
      x += word.w + space;
    }
  });
  ctx.restore();
}
