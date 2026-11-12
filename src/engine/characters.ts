import { INK, blob, circle, ellipse, stick, type Ctx, type Pt } from "./draw";
import type { Arm, Mood } from "./types";

/**
 * The cast: thin-style cartoon people — big round heads, heavy eyelids, stick
 * limbs, mitten hands and big shoes. All our own characters.
 */

export interface Look {
  skin: string;
  /** The eyelids' tint. */
  lid: string;
  top: string;
  legs: string;
  shoes: string;
  hair: string;
  style: "pony" | "bun" | "short" | "bob" | "pigtails" | "spiky" | "curly" | "bald";
  outfit: "dress" | "shirt" | "kurta" | "coat" | "saree";
  /** A second colour: the saree's drape, the tie, the cap. */
  accent?: string;
  lashes?: boolean;
  glasses?: boolean;
  freckles?: boolean;
  moustache?: boolean;
  beard?: boolean;
  bindi?: boolean;
  cap?: boolean;
}

export interface Character {
  id: string;
  name: string;
  blurb: string;
  /** The Gemini voice it speaks with unless another is picked. */
  voice: string;
  look: Look;
}

export interface Pose {
  t: number;
  /** Mouth opening, 0–1. */
  talk?: number;
  /** Mouth width, 0 round – 1 wide. */
  shape?: number;
  mood?: Mood;
  face?: 1 | -1;
  arm?: Arm;
  jump?: number;
  scale?: number;
  lean?: number;
}

export const CHARACTERS: Character[] = [
  { id: "meena", name: "Meena", blurb: "Always sleepy, always has a plan", voice: "Leda", look: { skin: "#E8C9A8", lid: "#E9C46A", top: "#A3B18A", legs: "#E8C9A8", shoes: "#3D405B", hair: "#6D597A", style: "pony", outfit: "dress", lashes: true } },
  { id: "riya", name: "Riya", blurb: "Glasses, too smart for her own good", voice: "Autonoe", look: { skin: "#D9A679", lid: "#8ECAE6", top: "#F4A261", legs: "#D9A679", shoes: "#264653", hair: "#2B2D42", style: "bob", outfit: "dress", lashes: true, glasses: true } },
  { id: "tara", name: "Tara", blurb: "Pure chaos in pigtails", voice: "Laomedeia", look: { skin: "#F0D2B6", lid: "#FFAFCC", top: "#9D4EDD", legs: "#F0D2B6", shoes: "#3D405B", hair: "#9C4A1A", style: "pigtails", outfit: "dress", lashes: true, freckles: true } },
  { id: "arjun", name: "Arjun", blurb: "The friend with big ideas", voice: "Puck", look: { skin: "#D9A679", lid: "#B7B7A4", top: "#E63946", legs: "#3D5A80", shoes: "#F1FAEE", hair: "#22223B", style: "spiky", outfit: "shirt" } },
  { id: "karthik", name: "Karthik", blurb: "Cap on, brain off", voice: "Fenrir", look: { skin: "#C68E5E", lid: "#A8DADC", top: "#2A9D8F", legs: "#33415C", shoes: "#E9C46A", hair: "#1B1B1E", style: "short", outfit: "shirt", cap: true, accent: "#E76F51" } },
  { id: "babu", name: "Babu", blurb: "Curly hair, zero worries", voice: "Achird", look: { skin: "#B97A4E", lid: "#DDB892", top: "#FFB703", legs: "#5F4B3A", shoes: "#3D405B", hair: "#2B1D14", style: "curly", outfit: "shirt" } },
  { id: "amma", name: "Amma", blurb: "Mom: sees everything", voice: "Kore", look: { skin: "#D9B08C", lid: "#C9A27E", top: "#B5838D", legs: "#D9B08C", shoes: "#3D405B", hair: "#3D2C2E", style: "bun", outfit: "saree", accent: "#E9C46A", lashes: true, bindi: true } },
  { id: "appa", name: "Appa", blurb: "Dad: one look is enough", voice: "Charon", look: { skin: "#C68E5E", lid: "#B08968", top: "#F1FAEE", legs: "#495057", shoes: "#2B2D42", hair: "#22223B", style: "short", outfit: "shirt", moustache: true } },
  { id: "paati", name: "Paati", blurb: "Grandma: sharper than everyone", voice: "Gacrux", look: { skin: "#D4A982", lid: "#C9ADA7", top: "#6A994E", legs: "#D4A982", shoes: "#6B4F3A", hair: "#D6D6D6", style: "bun", outfit: "saree", accent: "#BC4749", glasses: true, bindi: true } },
  { id: "thatha", name: "Thatha", blurb: "Grandpa: stories and naps", voice: "Algenib", look: { skin: "#C99A6B", lid: "#B5A08A", top: "#F8EDEB", legs: "#F8EDEB", shoes: "#6B4F3A", hair: "#E5E5E5", style: "bald", outfit: "kurta", glasses: true, moustache: true } },
  { id: "teacher", name: "Miss Rose", blurb: "The teacher who has heard it all", voice: "Sulafat", look: { skin: "#E0B990", lid: "#F28482", top: "#457B9D", legs: "#E0B990", shoes: "#1D3557", hair: "#5C3D2E", style: "short", outfit: "dress", lashes: true, glasses: true } },
  { id: "boss", name: "Boss", blurb: "Meetings, deadlines, sighs", voice: "Orus", look: { skin: "#D2A07A", lid: "#ADB5BD", top: "#343A40", legs: "#343A40", shoes: "#0B090A", hair: "#3A2E2A", style: "short", outfit: "coat", accent: "#E63946", beard: true } },
  { id: "doctor", name: "Doctor", blurb: "Calm, kind, slightly tired", voice: "Callirrhoe", look: { skin: "#E3BC9A", lid: "#BDE0FE", top: "#FFFFFF", legs: "#5C677D", shoes: "#3D405B", hair: "#40263A", style: "bob", outfit: "coat", accent: "#2A9D8F", lashes: true } },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/** Gemini's speech voices. */
export const VOICES: Array<{ name: string; kind: "F" | "M"; tone: string }> = [
  { name: "Leda", kind: "F", tone: "young" }, { name: "Autonoe", kind: "F", tone: "bright" }, { name: "Laomedeia", kind: "F", tone: "upbeat" },
  { name: "Kore", kind: "F", tone: "firm" }, { name: "Gacrux", kind: "F", tone: "mature" }, { name: "Sulafat", kind: "F", tone: "warm" },
  { name: "Callirrhoe", kind: "F", tone: "easy-going" }, { name: "Aoede", kind: "F", tone: "breezy" }, { name: "Zephyr", kind: "F", tone: "bright" },
  { name: "Despina", kind: "F", tone: "smooth" }, { name: "Erinome", kind: "F", tone: "clear" }, { name: "Achernar", kind: "F", tone: "soft" },
  { name: "Vindemiatrix", kind: "F", tone: "gentle" }, { name: "Pulcherrima", kind: "F", tone: "forward" },
  { name: "Puck", kind: "M", tone: "upbeat" }, { name: "Fenrir", kind: "M", tone: "excitable" }, { name: "Achird", kind: "M", tone: "friendly" },
  { name: "Charon", kind: "M", tone: "informative" }, { name: "Orus", kind: "M", tone: "firm" }, { name: "Algenib", kind: "M", tone: "gravelly" },
  { name: "Enceladus", kind: "M", tone: "breathy" }, { name: "Iapetus", kind: "M", tone: "clear" }, { name: "Umbriel", kind: "M", tone: "easy-going" },
  { name: "Algieba", kind: "M", tone: "smooth" }, { name: "Rasalgethi", kind: "M", tone: "informative" }, { name: "Alnilam", kind: "M", tone: "firm" },
  { name: "Schedar", kind: "M", tone: "even" }, { name: "Zubenelgenubi", kind: "M", tone: "casual" }, { name: "Sadachbia", kind: "M", tone: "lively" },
  { name: "Sadaltager", kind: "M", tone: "knowledgeable" },
];

const LINE = 8;

function armPose(arm: Arm, t: number, front: boolean): [Pt, Pt] {
  const sway = Math.sin(t * 2) * 4;
  // Hanging just outside the body, so both hands always show.
  const hanging: [Pt, Pt] = [[-82, -480], [-112 - sway, -370]];
  switch (arm) {
    case "hold": return front ? [[95, -470], [150, -555]] : [[-20, -470], [70, -545]];
    case "point": return front ? [[120, -590], [225, -640]] : hanging;
    case "up": return front ? [[95, -720], [115, -860]] : hanging;
    case "facepalm": return front ? [[115, -560], [70, -770]] : hanging;
    case "clasp": return front ? [[95, -500], [40, -600]] : [[-10, -500], [30, -600]];
    default: return front ? [[82, -480], [112 + sway, -370]] : hanging;
  }
}

/** A person standing at `x` with their feet on `y`; about 1000 units tall at scale 1. */
export function drawCharacter(ctx: Ctx, x: number, y: number, look: Look, pose: Pose) {
  const { t, talk = 0, mood = "normal", face = 1, arm = "down" } = pose;
  const scale = pose.scale ?? 1;
  const bob = talk > 0.05 ? -talk * 6 : Math.sin(t * 2.2 + x) * 3;
  const pants = look.outfit !== "dress" && look.outfit !== "saree";
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ellipse(ctx, 0, 6, 120, 18);
  ctx.fill();
  ctx.translate(0, -(pose.jump ?? 0));
  ctx.rotate((pose.lean ?? 0) * face);
  ctx.scale(face, 1);

  // Legs and big shoes.
  for (const side of [-1, 1]) {
    if (pants) stick(ctx, [[side * 30, -400], [side * 30, -44]], look.legs, 34);
    else stick(ctx, [[side * 26, -300], [side * 26, -40]], look.legs, 20);
    blob(ctx, look.shoes, () => ellipse(ctx, side * (pants ? 30 : 26) + 26, -24, 58, 28), LINE);
  }
  ctx.translate(0, bob);

  // The body.
  if (look.outfit === "dress" || look.outfit === "saree") {
    blob(ctx, look.top, () => {
      ctx.moveTo(-58, -630);
      ctx.lineTo(58, -630);
      ctx.lineTo(108, -290);
      ctx.lineTo(-108, -290);
      ctx.closePath();
    }, LINE);
    if (look.outfit === "saree") {
      // The drape, shoulder to hip.
      blob(ctx, look.accent ?? "#E9C46A", () => {
        ctx.moveTo(-58, -630);
        ctx.lineTo(-14, -630);
        ctx.lineTo(102, -330);
        ctx.lineTo(108, -290);
        ctx.lineTo(52, -290);
        ctx.closePath();
      }, 6);
    }
  } else {
    const hem = look.outfit === "kurta" ? -330 : -410;
    const flare = look.outfit === "kurta" ? 84 : 70;
    blob(ctx, look.top, () => {
      ctx.moveTo(-60, -630);
      ctx.lineTo(60, -630);
      ctx.lineTo(flare, hem);
      ctx.lineTo(-flare, hem);
      ctx.closePath();
    }, LINE);
    if (look.outfit === "coat") {
      // Lapels and a tie.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-26, -630);
      ctx.lineTo(4, -540);
      ctx.lineTo(34, -630);
      ctx.moveTo(4, -540);
      ctx.lineTo(6, hem);
      ctx.stroke();
      blob(ctx, look.accent ?? "#E63946", () => {
        ctx.moveTo(-6, -626);
        ctx.lineTo(14, -626);
        ctx.lineTo(20, -560);
        ctx.lineTo(4, -536);
        ctx.lineTo(-12, -560);
        ctx.closePath();
      }, 5);
    } else if (look.outfit === "shirt") {
      ctx.strokeStyle = "rgba(30,27,46,0.35)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(4, -624);
      ctx.lineTo(4, hem + 6);
      ctx.stroke();
    }
  }
  stick(ctx, [[0, -625], [0, -680]], look.skin, 26);

  // The back arm over the body too, so it isn't lost behind it.
  const [backE, backH] = armPose(arm, t, false);
  stick(ctx, [[-44, -605], backE, backH], look.skin, 16);
  blob(ctx, INK, () => ellipse(ctx, backH[0], backH[1], 22, 26), 0);

  drawHead(ctx, look, mood, talk, pose.shape ?? 0.5, t);

  const [frontE, frontH] = armPose(arm, t, true);
  stick(ctx, [[44, -605], frontE, frontH], look.skin, 16);
  blob(ctx, INK, () => ellipse(ctx, frontH[0], frontH[1], 22, 26), 0);
  ctx.restore();
}

function drawHead(ctx: Ctx, look: Look, mood: Mood, talk: number, shape: number, t: number) {
  const hx = 10;
  const hy = -830;

  // Hair behind the head.
  if (look.style === "pony") {
    blob(ctx, look.hair, () => {
      ctx.moveTo(-90, hy - 110);
      ctx.quadraticCurveTo(-230, hy - 60 + Math.sin(t * 3) * 6, -190, hy + 190);
      ctx.quadraticCurveTo(-150, hy + 60, -120, hy - 40);
      ctx.closePath();
    }, LINE);
  }
  if (look.style === "bun") blob(ctx, look.hair, () => circle(ctx, hx - 60, hy - 150, 60), LINE);
  if (look.style === "bob") blob(ctx, look.hair, () => ctx.roundRect(hx - 178, hy - 130, 356, 230, [150, 150, 40, 40]), LINE);
  if (look.style === "pigtails") {
    for (const side of [-1, 1]) {
      const swing = Math.sin(t * 4 + side) * 0.08;
      ctx.save();
      ctx.translate(hx + side * 150, hy - 40);
      ctx.rotate(side * (0.5 + swing));
      blob(ctx, look.hair, () => ellipse(ctx, 0, 70, 52, 95), LINE);
      ctx.restore();
      blob(ctx, "#F28482", () => circle(ctx, hx + side * 148, hy - 40, 18), 6);
    }
  }
  if (look.style === "curly") {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (1.02 + (k / 8) * 0.96);
      blob(ctx, look.hair, () => circle(ctx, hx + Math.cos(a) * 150, hy + Math.sin(a) * 150, 50), LINE);
    }
  }
  if (look.style === "spiky") {
    blob(ctx, look.hair, () => {
      ctx.moveTo(hx - 150, hy - 20);
      const spikes: Pt[] = [[-170, -150], [-100, -120], [-90, -215], [-20, -150], [20, -240], [70, -150], [130, -200], [130, -100]];
      for (const [dx, dy] of spikes) ctx.lineTo(hx + dx, hy + dy);
      ctx.lineTo(hx + 140, hy - 40);
      ctx.closePath();
    }, LINE);
  }

  // The ear and the head.
  blob(ctx, look.skin, () => circle(ctx, hx - 128, hy + 20, 30), LINE);
  blob(ctx, look.skin, () => circle(ctx, hx, hy, 150), LINE);

  // A beard along the jaw, inside the head.
  if (look.beard) {
    ctx.save();
    ctx.beginPath();
    circle(ctx, hx, hy, 146);
    ctx.clip();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(hx - 170, hy + 40);
    ctx.quadraticCurveTo(hx + 30, hy + 150, hx + 170, hy + 30);
    ctx.lineTo(hx + 170, hy + 170);
    ctx.lineTo(hx - 170, hy + 170);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Hair over the top of the head.
  if (look.style === "bald") {
    blob(ctx, look.hair, () => {
      ctx.arc(hx, hy, 154, Math.PI * 0.86, Math.PI * 1.22);
      ctx.quadraticCurveTo(hx - 110, hy - 40, hx - 120, hy + 60);
      ctx.closePath();
    }, LINE);
  } else {
    blob(ctx, look.hair, () => {
      ctx.arc(hx, hy, 154, Math.PI * 1.0, Math.PI * 1.85);
      ctx.quadraticCurveTo(hx + 20, hy - 90, hx - 60, hy - 70);
      ctx.quadraticCurveTo(hx - 120, hy - 50, hx - 154, hy);
      ctx.closePath();
    }, LINE);
  }
  if (look.cap) {
    const cap = look.accent ?? "#E76F51";
    blob(ctx, cap, () => {
      ctx.arc(hx, hy, 158, Math.PI * 1.02, Math.PI * 1.9);
      ctx.closePath();
    }, LINE);
    blob(ctx, cap, () => ctx.roundRect(hx + 60, hy - 96, 190, 34, 17), LINE);
  }

  // The big eyes and their heavy lids.
  const fx = hx + 30;
  const lid = mood === "sleep" ? 1 : mood === "shocked" ? 0.08 : mood === "happy" ? 0.35 : mood === "deadpan" ? 0.6 : mood === "proud" ? 0.55 : mood === "angry" ? 0.5 : 0.42;
  const blink = mood !== "sleep" && mood !== "shocked" && (t * 0.27) % 1 < 0.04;
  for (const [i, ex] of [fx - 52, fx + 56].entries()) {
    const ey = hy - 10;
    blob(ctx, "#fff", () => ellipse(ctx, ex, ey, 46, 58), 0);
    const gaze = mood === "shocked" ? 0 : 10;
    blob(ctx, INK, () => circle(ctx, ex + gaze, ey + 12, mood === "shocked" ? 7 : 10), 0);
    ctx.save();
    ctx.beginPath();
    ellipse(ctx, ex, ey, 46, 58);
    ctx.clip();
    const tilt = mood === "sad" ? (i ? 14 : -14) : mood === "angry" ? (i ? -18 : 18) : 0;
    const lidY = ey - 58 + 116 * (blink ? 1 : lid);
    ctx.fillStyle = look.lid;
    ctx.beginPath();
    ctx.moveTo(ex - 60, ey - 70);
    ctx.lineTo(ex + 60, ey - 70);
    ctx.lineTo(ex + 60, lidY + tilt);
    ctx.lineTo(ex - 60, lidY - tilt);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ex - 60, lidY - tilt);
    ctx.lineTo(ex + 60, lidY + tilt);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ellipse(ctx, ex, ey, 46, 58);
    ctx.stroke();
    if (look.lashes) {
      ctx.lineWidth = 5;
      const side = i ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + side * (0.7 + k * 0.25);
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * 46, ey + Math.sin(a) * 58);
        ctx.lineTo(ex + Math.cos(a) * 64, ey + Math.sin(a) * 74);
        ctx.stroke();
      }
    }
    if (mood === "sad") {
      const drop = ((t * 0.9 + i * 0.4) % 1) * 90;
      blob(ctx, "#8FD8FF", () => ellipse(ctx, ex + (i ? 30 : -30), ey + 60 + drop, 9, 14), 4);
    }
  }
  if (look.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    for (const ex of [fx - 52, fx + 56]) {
      ctx.beginPath();
      circle(ctx, ex, hy - 10, 66);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(fx - 52 + 66, hy - 14);
    ctx.lineTo(fx + 56 - 66, hy - 14);
    ctx.moveTo(fx - 52 - 66, hy - 14);
    ctx.lineTo(hx - 140, hy - 24);
    ctx.stroke();
  }
  if (look.freckles) {
    ctx.fillStyle = "rgba(160,90,60,0.7)";
    for (const [dx, dy] of [[-70, 70], [-52, 82], [-86, 86], [96, 70], [114, 82], [80, 86]]) {
      ctx.beginPath();
      circle(ctx, fx + dx, hy + dy, 5);
      ctx.fill();
    }
  }
  if (look.bindi) blob(ctx, "#D62828", () => circle(ctx, fx + 2, hy - 96, 9), 0);

  // Brows.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  for (const [i, ex] of [fx - 52, fx + 56].entries()) {
    const lift = mood === "shocked" ? 26 : mood === "angry" ? -14 : 0;
    const tilt = mood === "sad" ? (i ? -12 : 12) : mood === "angry" ? (i ? 16 : -16) : 0;
    ctx.beginPath();
    ctx.moveTo(ex - 26, hy - 90 - lift + tilt);
    ctx.lineTo(ex + 26, hy - 90 - lift - tilt);
    ctx.stroke();
  }
  // Nose.
  ctx.beginPath();
  ctx.arc(fx + 10, hy + 62, 10, -Math.PI * 0.3, Math.PI * 0.6);
  ctx.stroke();

  // Mouth: opens with the voice's loudness, widens with its brightness.
  const mx = fx + 8;
  const my = hy + 100;
  if (look.moustache) {
    ctx.strokeStyle = look.hair === "#E5E5E5" ? "#BDBDBD" : look.hair;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(mx - 40, my - 14);
    ctx.quadraticCurveTo(mx, my - 34, mx + 40, my - 14);
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  if (talk > 0.06) {
    const open = 8 + 34 * talk;
    const wide = 14 + 12 * shape + 5 * talk;
    blob(ctx, "#5C1424", () => ellipse(ctx, mx, my + open * 0.15, wide, open / 2), 6);
    if (talk > 0.45) {
      // Tongue, when the mouth is well open.
      ctx.save();
      ctx.beginPath();
      ellipse(ctx, mx, my + open * 0.15, wide - 3, open / 2 - 3);
      ctx.clip();
      ctx.fillStyle = "#E5707E";
      ctx.beginPath();
      ellipse(ctx, mx, my + open * 0.55, wide * 0.7, open * 0.3);
      ctx.fill();
      ctx.restore();
    }
  } else if (mood === "shocked") {
    blob(ctx, "#5C1424", () => ellipse(ctx, mx, my + 4, 14, 22), 6);
  } else {
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (mood === "happy" || mood === "proud") ctx.arc(mx, my - 18, 26, Math.PI * 0.2, Math.PI * 0.8);
    else if (mood === "sad" || mood === "angry") ctx.arc(mx, my + 20, 20, Math.PI * 1.2, Math.PI * 1.8);
    else {
      ctx.moveTo(mx - 18, my);
      ctx.lineTo(mx + 18, my);
    }
    ctx.stroke();
  }
}
