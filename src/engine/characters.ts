import { INK, blob, circle, ellipse, type Ctx, type Pt } from "./draw";
import { RICO_CHARACTERS, drawThin, type ThinLook } from "./rico";
import type { Arm, Mood } from "./types";

/**
 * The cast, in the Moolai Illa Machan cartoon style: a big round head with
 * big eyes, a rounded body, thick outlined limbs and round hands. All our own
 * characters.
 */

export interface Look {
  skin: string;
  shirt: string;
  pants: string;
  hair: "short" | "messy" | "bun" | "beanie" | "long" | "pony" | "braid" | "curly" | "spiky" | "bald";
  hairColor?: string;
  /** The beanie's colour (a monkey cap); dark when not given. */
  beanieColor?: string;
  /** A saree in this colour over the body; `shirt` is the blouse. */
  saree?: string;
  /** A knee-length skirt in this colour; the legs show below it. */
  skirt?: string;
  /** A long open coat over the shirt (a doctor's, a chef's). */
  coat?: string;
  tie?: string;
  /** Stripes across the shirt, e.g. a thief's. */
  stripes?: string;
  /** A belt and a badge: a uniform. */
  uniform?: boolean;
  hat?: "cap" | "police" | "chef";
  hatColor?: string;
  bindi?: boolean;
  mustache?: boolean;
  beard?: boolean;
  glasses?: boolean;
  shades?: boolean;
  lashes?: boolean;
  earrings?: boolean;
  /** A black band across the eyes. */
  mask?: boolean;
  /** Smaller than a grown-up: children. */
  size?: number;
}

export type CharacterStyle = "machan" | "rico";

export const STYLES: Array<{ id: CharacterStyle; name: string; blurb: string }> = [
  { id: "machan", name: "Classic", blurb: "Round faces and big eyes — bold and expressive." },
  { id: "rico", name: "Slim", blurb: "Long limbs, sleepy eyelids, deadpan faces." },
];

interface MachanCharacter {
  id: string;
  name: string;
  blurb: string;
  voice: string;
  look: Look;
}

export interface Character {
  id: string;
  name: string;
  blurb: string;
  /** The Gemini voice it speaks with unless another is picked. */
  voice: string;
  style: CharacterStyle;
  look: Look | ThinLook;
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

const HAIR = "#2A1A14";

const MACHAN_CHARACTERS: MachanCharacter[] = [
  // From Moolai Illa Machan.
  { id: "machan", name: "Machan", blurb: "Big plans, zero brain cells", voice: "Fenrir", look: { skin: "#C98B5E", shirt: "#FF7B3A", pants: "#2F3E66", hair: "messy" } },
  { id: "nanban", name: "Nanban", blurb: "The sensible friend, always suffering", voice: "Puck", look: { skin: "#B97A50", shirt: "#3A86FF", pants: "#3B3B4F", hair: "short" } },
  { id: "amma", name: "Amma", blurb: "Sees everything, forgives nothing", voice: "Kore", look: { skin: "#C68A60", shirt: "#E63946", pants: "#000", hair: "bun", saree: "#2A9D8F", bindi: true, lashes: true, earrings: true } },
  { id: "thatha", name: "Thatha", blurb: "Stories, naps and strong opinions", voice: "Algenib", look: { skin: "#B07A55", shirt: "#FFFFFF", pants: "#F1EFE6", hair: "bald", hairColor: "#D9D9D9", mustache: true, glasses: true } },
  { id: "thambi", name: "Thambi", blurb: "Little brother, big trouble", voice: "Achird", look: { skin: "#93603F", shirt: "#B5838D", pants: "#2B2D42", hair: "messy", hairColor: "#22160F", size: 0.84 } },
  { id: "mechanic", name: "Mechanic", blurb: "Fixes anything, charges everything", voice: "Zubenelgenubi", look: { skin: "#9C6440", shirt: "#F4F1EA", pants: "#22223B", hair: "messy", hairColor: "#1B1210", mustache: true } },
  { id: "driver", name: "Driver", blurb: "Auto anna with a shortcut for every road", voice: "Orus", look: { skin: "#A86B45", shirt: "#C9A66B", pants: "#3B3B4F", hair: "short", mustache: true } },
  { id: "annachi", name: "Annachi", blurb: "Shopkeeper who never has change", voice: "Charon", look: { skin: "#B5764A", shirt: "#F8F9FA", pants: "#3B3B4F", hair: "short", mustache: true, beard: true } },
  { id: "thief", name: "Thief", blurb: "Terrible at his only job", voice: "Enceladus", look: { skin: "#A87148", shirt: "#2B2D42", pants: "#2B2D42", hair: "beanie", stripes: "#EDEDED", mask: true, mustache: true } },
  { id: "police", name: "Inspector", blurb: "Stern voice, soft heart", voice: "Rasalgethi", look: { skin: "#A8714B", shirt: "#C2A878", pants: "#8C7851", hair: "short", hat: "police", hatColor: "#6B5B3E", uniform: true, mustache: true } },
  { id: "youtuber", name: "YouTuber", blurb: "Hello friends, welcome back", voice: "Sadachbia", look: { skin: "#B98058", shirt: "#212529", pants: "#343A40", hair: "spiky", hairColor: "#1B1210", shades: true } },
  // Family.
  { id: "appa", name: "Appa", blurb: "One look is enough", voice: "Iapetus", look: { skin: "#B5784E", shirt: "#457B9D", pants: "#F1EFE6", hair: "short", mustache: true, glasses: true } },
  { id: "paati", name: "Paati", blurb: "Grandma, sharper than everyone", voice: "Gacrux", look: { skin: "#C08A62", shirt: "#BC4749", pants: "#000", hair: "bun", hairColor: "#E5E5E5", saree: "#6A994E", bindi: true, glasses: true } },
  { id: "akka", name: "Akka", blurb: "Big sister, bigger attitude", voice: "Despina", look: { skin: "#C99470", shirt: "#F4A261", pants: "#000", hair: "long", saree: "#9D4EDD", lashes: true, earrings: true, bindi: true } },
  { id: "mama", name: "Mama", blurb: "Uncle with advice for everything", voice: "Alnilam", look: { skin: "#AD7350", shirt: "#E9D8A6", pants: "#F8F9FA", hair: "bald", hairColor: "#2B2B2B", mustache: true } },
  { id: "athai", name: "Athai", blurb: "Aunty who knows all the news", voice: "Sulafat", look: { skin: "#C9926B", shirt: "#F9C74F", pants: "#000", hair: "bun", saree: "#7B2CBF", bindi: true, glasses: true, earrings: true, lashes: true } },
  { id: "chintu", name: "Chintu", blurb: "Small boy, big questions", voice: "Laomedeia", look: { skin: "#C48A5E", shirt: "#FB8500", pants: "#023047", hair: "spiky", size: 0.72 } },
  { id: "pappa", name: "Pappa", blurb: "Tiny, cute, completely in charge", voice: "Leda", look: { skin: "#CB9068", shirt: "#FF8FAB", pants: "#CB9068", hair: "pony", skirt: "#FF4D6D", lashes: true, size: 0.7 } },
  // Friends and college.
  { id: "meena", name: "Meena", blurb: "Always sleepy, always has a plan", voice: "Leda", look: { skin: "#D19A6E", shirt: "#80B918", pants: "#D19A6E", hair: "pony", hairColor: "#3D2C2E", skirt: "#2B9348", lashes: true, earrings: true } },
  { id: "priya", name: "Priya", blurb: "College topper with a braid", voice: "Zephyr", look: { skin: "#C48D67", shirt: "#118AB2", pants: "#C48D67", hair: "braid", skirt: "#073B4C", lashes: true, bindi: true, glasses: true } },
  { id: "divya", name: "Divya", blurb: "Long hair, sharp comebacks", voice: "Aoede", look: { skin: "#D7A47D", shirt: "#EF476F", pants: "#264653", hair: "long", lashes: true, earrings: true } },
  { id: "riya", name: "Riya", blurb: "Too smart for her own good", voice: "Autonoe", look: { skin: "#CF9B74", shirt: "#F4A261", pants: "#CF9B74", hair: "short", hairColor: "#22223B", skirt: "#E76F51", lashes: true, glasses: true } },
  { id: "arjun", name: "Arjun", blurb: "The friend with big ideas", voice: "Puck", look: { skin: "#B47A52", shirt: "#E63946", pants: "#1D3557", hair: "spiky" } },
  { id: "karthik", name: "Karthik", blurb: "Cap on, brain off", voice: "Fenrir", look: { skin: "#A7704A", shirt: "#2A9D8F", pants: "#33415C", hair: "short", hat: "cap", hatColor: "#E76F51" } },
  { id: "babu", name: "Babu", blurb: "Curly hair, zero worries", voice: "Achird", look: { skin: "#9A6340", shirt: "#FFB703", pants: "#5F4B3A", hair: "curly" } },
  { id: "surya", name: "Surya", blurb: "The hero of every story", voice: "Algieba", look: { skin: "#B07650", shirt: "#6A4C93", pants: "#22223B", hair: "short", beard: true } },
  // Work.
  { id: "teacher", name: "Teacher", blurb: "Has heard every excuse", voice: "Sulafat", look: { skin: "#C99470", shirt: "#F1FAEE", pants: "#000", hair: "bun", saree: "#457B9D", glasses: true, bindi: true, lashes: true } },
  { id: "boss", name: "Boss", blurb: "Meetings, deadlines, sighs", voice: "Schedar", look: { skin: "#B5784E", shirt: "#F8F9FA", pants: "#343A40", hair: "short", coat: "#343A40", tie: "#E63946", beard: true } },
  { id: "doctor", name: "Doctor", blurb: "Calm, kind, slightly tired", voice: "Callirrhoe", look: { skin: "#C99470", shirt: "#8ECAE6", pants: "#5C677D", hair: "pony", coat: "#FFFFFF", lashes: true, glasses: true } },
  { id: "chef", name: "Chef", blurb: "Everything needs more salt", voice: "Umbriel", look: { skin: "#B07650", shirt: "#FFFFFF", pants: "#343A40", hair: "short", hat: "chef", coat: "#FFFFFF", tie: "#E63946", mustache: true } },
  { id: "nurse", name: "Nurse", blurb: "Kind, quick, no nonsense", voice: "Erinome", look: { skin: "#C48D67", shirt: "#48CAE4", pants: "#C48D67", hair: "bun", skirt: "#48CAE4", lashes: true } },
  { id: "vicky", name: "Vicky", blurb: "Too cool, shades always on", voice: "Sadaltager", look: { skin: "#B98058", shirt: "#FFD60A", pants: "#212529", hair: "messy", hairColor: "#3A2618", shades: true } },
  // More people around town.
  { id: "rowdy", name: "Rowdy", blurb: "Scary face, scared of his mother", voice: "Algenib", look: { skin: "#8E5A3A", shirt: "#1B1B1E", pants: "#3D405B", hair: "messy", hairColor: "#111", beard: true, mustache: true } },
  { id: "politician", name: "Thalaivar", blurb: "Promises everything, does nothing", voice: "Rasalgethi", look: { skin: "#A86B45", shirt: "#FFFFFF", pants: "#FFFFFF", hair: "bald", hairColor: "#2B2B2B", mustache: true, glasses: true } },
  { id: "techie", name: "Techie", blurb: "Works from home, sleeps at work", voice: "Iapetus", look: { skin: "#B47A52", shirt: "#6C757D", pants: "#22223B", hair: "short", glasses: true, beard: true } },
  { id: "postman", name: "Postman", blurb: "Knows every house, every secret", voice: "Charon", look: { skin: "#9C6440", shirt: "#C9A66B", pants: "#8C7851", hair: "short", hat: "cap", hatColor: "#8C7851", uniform: true, mustache: true } },
  { id: "watchman", name: "Watchman", blurb: "Awake only when you're late", voice: "Orus", look: { skin: "#8A5A3C", shirt: "#1D3557", pants: "#1D3557", hair: "short", hat: "police", hatColor: "#14213D", uniform: true, mustache: true } },
  { id: "farmer", name: "Vivasayi", blurb: "Up at five, wiser than all of us", voice: "Algenib", look: { skin: "#8E5A3A", shirt: "#F1EFE6", pants: "#2D6A4F", hair: "short", hairColor: "#555", mustache: true } },
  { id: "cricketer", name: "Cricketer", blurb: "Every argument ends in a match", voice: "Puck", look: { skin: "#B07650", shirt: "#F8F9FA", pants: "#F8F9FA", hair: "short", hat: "cap", hatColor: "#1D4ED8" } },
  { id: "gymbro", name: "Gym Bro", blurb: "Has skipped leg day since 2019", voice: "Fenrir", look: { skin: "#A7704A", shirt: "#E63946", pants: "#212529", hair: "spiky" } },
  { id: "kamala", name: "Kamala Aunty", blurb: "The neighbour who hears everything", voice: "Pulcherrima", look: { skin: "#C08A62", shirt: "#E9C46A", pants: "#000", hair: "bun", saree: "#E76F51", bindi: true, earrings: true, lashes: true } },
  { id: "swathi", name: "Swathi", blurb: "Influencer, 12 followers", voice: "Zephyr", look: { skin: "#D19A6E", shirt: "#B5179E", pants: "#264653", hair: "long", hairColor: "#4A2C2A", shades: true, lashes: true, earrings: true } },
];

export const CHARACTERS: Character[] = [
  ...MACHAN_CHARACTERS.map((c) => ({ ...c, style: "machan" as const })),
  ...RICO_CHARACTERS.map((c) => ({ ...c, style: "rico" as const })),
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export const isThin = (look: Look | ThinLook): look is ThinLook => "kind" in look && look.kind === "rico";

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

const LINE = 9;
/** People are drawn this much bigger than their coordinates, so a scale of 1 stands about 1000 units tall with the scenes. */
export const BODY = 1.42;

function limb(ctx: Ctx, pts: Pt[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + LINE * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Where the front arm's elbow and hand go, from the front shoulder. */
function frontArm(arm: Arm, t: number): [Pt, Pt] {
  switch (arm) {
    case "hold": return [[135, -300], [150, -425]];
    case "point": return [[160, -420], [255, -470]];
    case "up": return [[130, -500], [165, -650]];
    case "facepalm": return [[160, -440], [40, -560]];
    case "clasp": return [[150, -330], [205, -390]];
    default: return [[95, -290], [100 + Math.sin(t * 2) * 4, -205]];
  }
}

/** A person standing at `x` with their feet on `y`, in their own style. */
export function drawCharacter(ctx: Ctx, x: number, y: number, look: Look | ThinLook, pose: Pose) {
  if (isThin(look)) drawThin(ctx, x, y, look, pose);
  else drawMachan(ctx, x, y, look, pose);
}

function drawMachan(ctx: Ctx, x: number, y: number, look: Look, pose: Pose) {
  const { t, talk = 0, mood = "normal", face = 1, arm = "down" } = pose;
  const bob = talk > 0.05 ? -talk * 7 : Math.sin(t * 2.4 + x) * 3;
  const scale = (pose.scale ?? 1) * BODY * (look.size ?? 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ellipse(ctx, 0, 6, 135, 22);
  ctx.fill();
  ctx.translate(0, -(pose.jump ?? 0));
  ctx.rotate((pose.lean ?? 0) * face);
  ctx.scale(face, 1);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Legs; a saree hides all but the feet, a skirt shows the legs below it.
  for (const side of [-1, 1]) {
    const hip: Pt = [side * 34, -175];
    const foot: Pt = [side * 34, -10];
    if (!look.saree) limb(ctx, [hip, foot], look.skirt ? look.skin : look.pants, look.skirt ? 34 : 50);
    blob(ctx, INK, () => ellipse(ctx, foot[0] + 16, foot[1] + 2, 38, 20), 0);
  }

  ctx.translate(0, bob);
  const shoulderF: Pt = [62, -378];
  const shoulderB: Pt = [-62, -378];
  const sleeve = look.coat ?? look.shirt;
  const drawArm = (s: Pt, [e, h]: [Pt, Pt]) => {
    limb(ctx, [s, e], sleeve, 44);
    limb(ctx, [e, h], look.skin, 30);
    blob(ctx, look.skin, () => circle(ctx, h[0], h[1], 24), LINE);
  };

  // The back arm, behind the body.
  drawArm(shoulderB, arm === "clasp" ? [[-40, -300], [110, -330]] : [[-95, -290], [-100, -205]]);

  // Body.
  if (look.saree) {
    blob(ctx, look.saree, () => {
      ctx.moveTo(-80, -200);
      ctx.lineTo(80, -200);
      ctx.lineTo(118, -8);
      ctx.lineTo(-118, -8);
      ctx.closePath();
    }, LINE);
  }
  if (look.skirt) {
    blob(ctx, look.skirt, () => {
      ctx.moveTo(-84, -215);
      ctx.lineTo(84, -215);
      ctx.lineTo(118, -88);
      ctx.lineTo(-118, -88);
      ctx.closePath();
    }, LINE);
  }
  if (look.coat) {
    // A long coat, open at the front over the shirt.
    blob(ctx, look.coat, () => ctx.roundRect(-96, -420, 192, 300, [64, 64, 18, 18]), LINE);
    blob(ctx, look.shirt, () => ctx.rect(-26, -414, 52, 230), 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-26, -416);
    ctx.lineTo(-26, -126);
    ctx.moveTo(26, -416);
    ctx.lineTo(26, -126);
    ctx.stroke();
  } else {
    blob(ctx, look.shirt, () => ctx.roundRect(-88, -420, 176, 252, [64, 64, 30, 30]), LINE);
  }
  if (look.tie) {
    blob(ctx, look.tie, () => {
      ctx.moveTo(-10, -404);
      ctx.lineTo(10, -404);
      ctx.lineTo(16, -260);
      ctx.lineTo(0, -236);
      ctx.lineTo(-16, -260);
      ctx.closePath();
    }, 6);
  }
  if (look.stripes) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-84, -416, 168, 244, [60, 60, 28, 28]);
    ctx.clip();
    ctx.fillStyle = look.stripes;
    for (let s = -400; s < -170; s += 46) ctx.fillRect(-90, s, 180, 20);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.beginPath();
    ctx.roundRect(-88, -420, 176, 252, [64, 64, 30, 30]);
    ctx.stroke();
  }
  if (look.uniform) {
    blob(ctx, "#4A3F2C", () => ctx.rect(-86, -214, 172, 30), 6);
    blob(ctx, "#F4C542", () => ctx.rect(-12, -216, 26, 34), 5);
    blob(ctx, "#F4C542", () => circle(ctx, -42, -340, 14), 5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.strokeRect(18, -360, 40, 44);
  }
  if (look.saree) {
    // The pallu over the shoulder, with a gold border.
    blob(ctx, look.saree, () => {
      ctx.moveTo(-70, -415);
      ctx.lineTo(-20, -420);
      ctx.lineTo(90, -210);
      ctx.lineTo(60, -175);
      ctx.closePath();
    }, LINE);
    ctx.strokeStyle = "#F4C542";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-14, -404);
    ctx.lineTo(80, -214);
    ctx.stroke();
  } else if (!look.stripes && !look.coat && !look.tie) {
    // A collar.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-26, -418);
    ctx.lineTo(0, -380);
    ctx.lineTo(26, -418);
    ctx.stroke();
  }

  drawHead(ctx, look, mood, talk, pose.shape ?? 0.5, t + x * 0.01);

  const front = frontArm(arm, t);
  drawArm(shoulderF, front);
  if (arm === "clasp") blob(ctx, look.skin, () => ctx.roundRect(front[1][0] - 10, front[1][1] - 58, 20, 44, 10), LINE);
  ctx.restore();
}

function drawHead(ctx: Ctx, look: Look, mood: Mood, talk: number, shape: number, t: number) {
  const hair = look.hairColor ?? HAIR;
  const hy = -540;

  // Neck, and hair that hangs behind the head.
  blob(ctx, look.skin, () => ctx.rect(-24, -440, 48, 40), LINE);
  if (look.hair === "bun") blob(ctx, hair, () => circle(ctx, -100, -625, 52), LINE);
  if (look.hair === "long") blob(ctx, hair, () => ctx.roundRect(-136, hy - 60, 250, 250, [120, 120, 50, 50]), LINE);
  if (look.hair === "pony") {
    blob(ctx, hair, () => {
      ctx.moveTo(-90, hy - 90);
      ctx.quadraticCurveTo(-220, hy - 40 + Math.sin(t * 3) * 6, -170, hy + 150);
      ctx.quadraticCurveTo(-130, hy + 40, -105, hy - 20);
      ctx.closePath();
    }, LINE);
  }
  if (look.hair === "braid") {
    for (let k = 4; k >= 0; k--) {
      const sway = Math.sin(t * 2.4 + k * 0.5) * k * 2;
      blob(ctx, hair, () => ellipse(ctx, -118 - k * 6 + sway, hy + 40 + k * 62, 34 - k * 3, 38), LINE);
    }
  }
  blob(ctx, look.skin, () => circle(ctx, -108, hy + 6, 26), LINE);
  blob(ctx, look.skin, () => circle(ctx, 0, hy, 118), LINE);
  if (look.earrings) blob(ctx, "#F4C542", () => circle(ctx, -110, hy + 40, 11), 5);

  // A beard along the jaw.
  if (look.beard) {
    ctx.save();
    ctx.beginPath();
    circle(ctx, 0, hy, 114);
    ctx.clip();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.moveTo(-130, hy + 20);
    ctx.quadraticCurveTo(10, hy + 125, 130, hy + 10);
    ctx.lineTo(130, hy + 130);
    ctx.lineTo(-130, hy + 130);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Hair, or a hat, over the top of the head.
  if (look.hair === "beanie") {
    const cap = look.beanieColor ?? "#2B2D42";
    blob(ctx, cap, () => {
      ctx.arc(0, hy - 4, 124, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
    }, LINE);
    blob(ctx, cap, () => ctx.roundRect(-128, hy - 40, 256, 40, 18), LINE);
    if (look.beanieColor) blob(ctx, "#fff", () => circle(ctx, 0, hy - 128, 26), LINE);
  } else if (look.hair === "bald") {
    // Tufts over the ears and a shine on top.
    for (const side of [-1, 1]) blob(ctx, hair, () => ellipse(ctx, side * 104, hy - 30, 26, 44), LINE);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ellipse(ctx, 30, hy - 82, 30, 14);
    ctx.fill();
  } else if (look.hair === "curly") {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (1.02 + (k / 8) * 0.96);
      blob(ctx, hair, () => circle(ctx, Math.cos(a) * 112, hy + Math.sin(a) * 112, 42), LINE);
    }
  } else {
    blob(ctx, hair, () => {
      ctx.arc(0, hy, 124, Math.PI * 0.98, Math.PI * 2.02);
      ctx.quadraticCurveTo(90, hy - 70, 30, hy - 60);
      ctx.quadraticCurveTo(-30, hy - 50, -70, hy - 82);
      ctx.quadraticCurveTo(-110, hy - 40, -124, hy);
      ctx.closePath();
    }, LINE);
    if (look.hair === "messy") {
      for (const [sx, a] of [[-70, -0.7], [-20, -0.2], [35, 0.3], [80, 0.8]] as const) {
        blob(ctx, hair, () => {
          ctx.moveTo(sx - 26, hy - 100);
          ctx.lineTo(sx + Math.sin(a) * 70, hy - 160 - Math.cos(a) * 20 + Math.sin(t * 3 + sx) * 4);
          ctx.lineTo(sx + 26, hy - 104);
          ctx.closePath();
        }, 7);
      }
    }
    if (look.hair === "spiky") {
      blob(ctx, hair, () => {
        ctx.moveTo(-118, hy - 40);
        const spikes: Pt[] = [[-140, -150], [-80, -120], [-60, -200], [-10, -130], [30, -215], [60, -125], [120, -170], [120, -60]];
        for (const [dx, dy] of spikes) ctx.lineTo(dx, hy + dy);
        ctx.lineTo(124, hy - 10);
        ctx.closePath();
      }, LINE);
    }
  }
  if (look.hat === "cap") {
    const cap = look.hatColor ?? "#E76F51";
    blob(ctx, cap, () => {
      ctx.arc(0, hy - 6, 126, Math.PI * 1.02, Math.PI * 1.98);
      ctx.closePath();
    }, LINE);
    blob(ctx, cap, () => ctx.roundRect(40, hy - 34, 150, 30, 15), LINE);
  }
  if (look.hat === "police") {
    const cloth = look.hatColor ?? "#6B5B3E";
    blob(ctx, cloth, () => {
      ctx.moveTo(-130, hy - 70);
      ctx.quadraticCurveTo(-150, hy - 190, 0, hy - 190);
      ctx.quadraticCurveTo(150, hy - 190, 134, hy - 70);
      ctx.closePath();
    }, LINE);
    blob(ctx, INK, () => ctx.roundRect(-120, hy - 90, 290, 30, 15), 0);
    blob(ctx, "#F4C542", () => circle(ctx, 20, hy - 136, 20), 6);
  }
  if (look.hat === "chef") {
    for (const [dx, r] of [[-60, 50], [0, 62], [64, 50]] as const) blob(ctx, "#FFFFFF", () => circle(ctx, dx, hy - 196, r), LINE);
    blob(ctx, "#FFFFFF", () => ctx.roundRect(-96, hy - 186, 192, 100, 10), LINE);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(-86, hy - 210, 172, 50);
  }

  const fx = 16;
  const eyeY = hy - 6;
  const eyes: Pt[] = [[fx - 40, eyeY], [fx + 44, eyeY]];
  const blink = (t * 0.29) % 1 < 0.035 && mood !== "shocked";

  if (look.mask) blob(ctx, INK, () => ctx.roundRect(-120, eyeY - 42, 245, 78, 30), 0);

  // Eyes.
  for (const [ex, ey] of eyes) {
    if (mood === "sleep") {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(ex, ey - 6, 18, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    if (mood === "happy" && talk < 0.05 && (t * 0.5) % 1 < 0.5) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(ex, ey + 8, 18, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      continue;
    }
    const big = mood === "shocked" ? 1.4 : 1;
    const ry = blink ? 3 : 29 * big;
    blob(ctx, "#fff", () => ellipse(ctx, ex, ey, 24 * big, ry), 6);
    if (!blink) {
      blob(ctx, INK, () => circle(ctx, ex + 7, ey + 2, mood === "shocked" ? 8 : 12), 0);
      blob(ctx, "#fff", () => circle(ctx, ex + 10, ey - 3, 3.5), 0);
    }
    // Heavy lids: proud looks down its nose, deadpan barely bothers.
    if ((mood === "proud" || mood === "deadpan") && !blink) {
      blob(ctx, look.skin, () => ctx.rect(ex - 30, ey - 36, 60, mood === "deadpan" ? 38 : 30), 0);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(ex - 24, ey + (mood === "deadpan" ? 2 : -6));
      ctx.lineTo(ex + 24, ey + (mood === "deadpan" ? 2 : -6));
      ctx.stroke();
    }
    if (look.lashes && !blink) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      const side = ex < fx ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(ex + side * 18, ey - 22);
      ctx.lineTo(ex + side * 32, ey - 34);
      ctx.stroke();
    }
  }
  if (look.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      circle(ctx, ex, ey, 36);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(eyes[0][0] + 36, eyeY - 4);
    ctx.lineTo(eyes[1][0] - 36, eyeY - 4);
    ctx.moveTo(eyes[0][0] - 36, eyeY - 6);
    ctx.lineTo(-100, eyeY - 14);
    ctx.stroke();
  }
  if (look.shades) {
    for (const [ex, ey] of eyes) blob(ctx, "#15131F", () => ctx.roundRect(ex - 38, ey - 28, 76, 54, [12, 12, 26, 26]), 6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(eyes[0][0] + 38, eyeY - 16);
    ctx.lineTo(eyes[1][0] - 38, eyeY - 16);
    ctx.moveTo(eyes[0][0] - 38, eyeY - 16);
    ctx.lineTo(-104, eyeY - 18);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 5;
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      ctx.moveTo(ex - 22, ey - 12);
      ctx.lineTo(ex - 8, ey - 20);
      ctx.stroke();
    }
  }

  // Eyebrows.
  ctx.strokeStyle = look.mask ? "#555" : INK;
  ctx.lineWidth = 10;
  const [l, r] = eyes;
  const brows = (left: [number, number], right: [number, number]) => {
    // Each pair is [outer end, inner end] lift.
    ctx.beginPath();
    ctx.moveTo(l[0] - 22, eyeY - 48 - left[0]);
    ctx.lineTo(l[0] + 22, eyeY - 48 - left[1]);
    ctx.moveTo(r[0] - 22, eyeY - 48 - right[1]);
    ctx.lineTo(r[0] + 22, eyeY - 48 - right[0]);
    ctx.stroke();
  };
  if (mood === "sad") brows([-4, 14], [-4, 14]);
  else if (mood === "angry") brows([10, -12], [10, -12]);
  else if (mood === "shocked") brows([18, 18], [18, 18]);
  else brows([0, 0], [0, 0]);

  // Nose, cheeks, bindi.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(fx + 12, hy + 28, 12, -Math.PI * 0.4, Math.PI * 0.6);
  ctx.stroke();
  if (mood === "happy" || mood === "proud") {
    ctx.fillStyle = "rgba(255,95,125,0.35)";
    for (const [cx] of eyes) {
      ctx.beginPath();
      circle(ctx, cx + (cx < fx ? -14 : 12), hy + 44, 20);
      ctx.fill();
    }
  }
  if (look.bindi) blob(ctx, "#D62828", () => circle(ctx, fx + 4, eyeY - 62, 9), 0);

  // Mouth: opens with the voice's loudness, widens with its brightness.
  const mx = fx + 6;
  const my = hy + 70;
  if (talk > 0.06) {
    const open = 10 + 34 * talk;
    blob(ctx, "#6B1426", () => ellipse(ctx, mx, my, 18 + 8 * talk + 10 * shape, open / 2), 7);
    blob(ctx, "#E86A7C", () => ellipse(ctx, mx, my + open / 2 - 7, 13, Math.max(3, open / 5)), 0);
  } else if (mood === "shocked") {
    blob(ctx, "#6B1426", () => ellipse(ctx, mx, my + 4, 17, 25), 7);
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (mood === "happy" || mood === "proud") ctx.arc(mx, my - 22, 32, Math.PI * 0.2, Math.PI * 0.8);
    else if (mood === "sad" || mood === "angry") ctx.arc(mx, my + 22, 24, Math.PI * 1.2, Math.PI * 1.8);
    else if (mood === "deadpan") {
      ctx.moveTo(mx - 20, my);
      ctx.lineTo(mx + 20, my);
    } else if (mood === "sleep") {
      ellipse(ctx, mx, my, 9, 11);
    } else ctx.arc(mx, my - 12, 20, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  }
  if (look.mustache) {
    blob(ctx, look.hair === "bald" && look.hairColor === "#D9D9D9" ? "#CFCFCF" : hair, () => {
      ctx.moveTo(mx - 38, my - 14);
      ctx.quadraticCurveTo(mx, my - 40, mx + 38, my - 14);
      ctx.quadraticCurveTo(mx, my - 24, mx - 38, my - 14);
    }, 0);
  }
}
