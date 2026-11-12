import { INK, blob, circle, ellipse, label, type Ctx } from "./draw";

/** Where a background is drawn: the frame, the floor line, a unit that follows the people's size, and the clock. */
export interface Stage {
  W: number;
  H: number;
  floor: number;
  u: number;
  t: number;
}

export interface Background {
  id: string;
  name: string;
  /** Other words for it in a script's "[bg: …]". */
  alias: string[];
  /** A swatch for the picker. */
  swatch: [string, string];
  draw: (ctx: Ctx, s: Stage) => void;
}

const PAD = 600;

function walls(ctx: Ctx, s: Stage, wall: string, ground: string) {
  ctx.fillStyle = wall;
  ctx.fillRect(-PAD, -PAD, s.W + PAD * 2, s.floor + PAD);
  ctx.fillStyle = ground;
  ctx.fillRect(-PAD, s.floor, s.W + PAD * 2, s.H - s.floor + PAD);
  ctx.strokeStyle = "rgba(30,27,46,0.28)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-PAD, s.floor);
  ctx.lineTo(s.W + PAD, s.floor);
  ctx.stroke();
}

function sky(ctx: Ctx, s: Stage, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, s.floor);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-PAD, -PAD, s.W + PAD * 2, s.floor + PAD);
}

function cloud(ctx: Ctx, x: number, y: number, k: number, color = "#fff") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ellipse(ctx, x, y, 90 * k, 40 * k);
  ellipse(ctx, x - 60 * k, y + 14 * k, 60 * k, 30 * k);
  ellipse(ctx, x + 66 * k, y + 12 * k, 66 * k, 32 * k);
  ctx.fill();
}

function windowAt(ctx: Ctx, x: number, y: number, w: number, h: number, glass: string) {
  blob(ctx, "#fff", () => ctx.roundRect(x - w / 2 - 14, y - h / 2 - 14, w + 28, h + 28, 14), 8);
  blob(ctx, glass, () => ctx.rect(x - w / 2, y - h / 2, w, h), 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
}

function tree(ctx: Ctx, x: number, floor: number, k: number, leaf = "#74C69D") {
  blob(ctx, "#8D6E63", () => ctx.rect(x - 22 * k, floor - 300 * k, 44 * k, 300 * k), 8);
  blob(ctx, leaf, () => {
    circle(ctx, x, floor - 400 * k, 150 * k);
  }, 8);
  blob(ctx, leaf, () => circle(ctx, x - 110 * k, floor - 320 * k, 95 * k), 8);
  blob(ctx, leaf, () => circle(ctx, x + 110 * k, floor - 320 * k, 95 * k), 8);
}

export const BACKGROUNDS: Background[] = [
  {
    id: "room", name: "Plain room", alias: ["home", "veedu", "house"], swatch: ["#ECEAE4", "#D8D4CA"],
    draw(ctx, s) {
      walls(ctx, s, "#ECEAE4", "#D8D4CA");
      const y = s.floor - 900 * s.u;
      blob(ctx, "#F6BD60", () => ctx.roundRect(s.W / 2 - 110 * s.u, y - 80 * s.u, 220 * s.u, 160 * s.u, 10), 8);
      blob(ctx, "#84A59D", () => circle(ctx, s.W / 2 - 30 * s.u, y + 10 * s.u, 40 * s.u), 6);
      blob(ctx, "#F28482", () => circle(ctx, s.W / 2 + 40 * s.u, y - 10 * s.u, 28 * s.u), 6);
    },
  },
  {
    id: "classroom", name: "Classroom", alias: ["school", "class", "palli", "pallikoodam"], swatch: ["#EDE7D9", "#52796F"],
    draw(ctx, s) {
      walls(ctx, s, "#EDE7D9", "#C9B79C");
      const y = s.floor - 900 * s.u;
      const w = 520 * s.u;
      const h = 280 * s.u;
      blob(ctx, "#8D6E63", () => ctx.roundRect(s.W / 2 - w / 2 - 16, y - h / 2 - 16, w + 32, h + 32, 12), 8);
      blob(ctx, "#52796F", () => ctx.rect(s.W / 2 - w / 2, y - h / 2, w, h), 6);
      label(ctx, "2 + 2 = ?", s.W / 2, y - 30 * s.u, 70 * s.u, "rgba(255,255,255,0.88)");
      label(ctx, "A B C", s.W / 2, y + 60 * s.u, 54 * s.u, "rgba(255,255,255,0.6)");
    },
  },
  {
    id: "kitchen", name: "Kitchen", alias: ["samayal", "cooking"], swatch: ["#FFE8D6", "#DDBEA9"],
    draw(ctx, s) {
      walls(ctx, s, "#FFE8D6", "#CB997E");
      const y = s.floor - 920 * s.u;
      // A shelf of pots, and tiles under it.
      ctx.strokeStyle = "rgba(30,27,46,0.1)";
      ctx.lineWidth = 4;
      for (let x = -PAD; x < s.W + PAD; x += 120 * s.u) {
        ctx.beginPath();
        ctx.moveTo(x, s.floor - 620 * s.u);
        ctx.lineTo(x, s.floor);
        ctx.stroke();
      }
      blob(ctx, "#B08968", () => ctx.rect(s.W / 2 - 330 * s.u, y + 60 * s.u, 660 * s.u, 26 * s.u), 8);
      const pots: Array<[number, string, number]> = [[-220, "#E76F51", 60], [-60, "#2A9D8F", 76], [110, "#E9C46A", 64], [250, "#577590", 50]];
      for (const [dx, color, r] of pots) blob(ctx, color, () => ctx.roundRect(s.W / 2 + (dx - r) * s.u, y + (60 - r * 1.3) * s.u, r * 2 * s.u, r * 1.3 * s.u, [8, 8, 24 * s.u, 24 * s.u]), 8);
    },
  },
  {
    id: "living", name: "Living room", alias: ["hall", "sofa", "tv"], swatch: ["#DCE8F2", "#BFA58A"],
    draw(ctx, s) {
      walls(ctx, s, "#DCE8F2", "#BFA58A");
      const y = s.floor - 900 * s.u;
      windowAt(ctx, s.W / 2, y, 380 * s.u, 280 * s.u, "#BDE0FE");
      cloud(ctx, s.W / 2 - 60 * s.u, y - 50 * s.u, 0.6 * s.u);
      // A sofa along the wall.
      blob(ctx, "#E07A5F", () => ctx.roundRect(s.W / 2 - 360 * s.u, s.floor - 330 * s.u, 720 * s.u, 220 * s.u, 40 * s.u), 8);
      blob(ctx, "#C8553D", () => ctx.roundRect(s.W / 2 - 400 * s.u, s.floor - 200 * s.u, 800 * s.u, 180 * s.u, 30 * s.u), 8);
    },
  },
  {
    id: "bedroom", name: "Bedroom (night)", alias: ["night", "bed", "iravu"], swatch: ["#3D405B", "#1E1B2E"],
    draw(ctx, s) {
      walls(ctx, s, "#4A4E69", "#2F3148");
      const y = s.floor - 900 * s.u;
      windowAt(ctx, s.W / 2, y, 340 * s.u, 300 * s.u, "#22223B");
      blob(ctx, "#FFF3B0", () => circle(ctx, s.W / 2 + 70 * s.u, y - 60 * s.u, 46 * s.u), 0);
      ctx.fillStyle = "#fff";
      for (const [dx, dy] of [[-110, -90], [-60, 40], [-130, 90], [110, 80], [20, -20]]) {
        const tw = 3 + 2 * Math.sin(s.t * 2 + dx);
        ctx.beginPath();
        circle(ctx, s.W / 2 + dx * s.u, y + dy * s.u, tw * s.u);
        ctx.fill();
      }
      // A bed.
      blob(ctx, "#9A8C98", () => ctx.roundRect(s.W / 2 - 380 * s.u, s.floor - 190 * s.u, 760 * s.u, 170 * s.u, 20 * s.u), 8);
      blob(ctx, "#F2E9E4", () => ctx.roundRect(s.W / 2 - 350 * s.u, s.floor - 250 * s.u, 220 * s.u, 90 * s.u, 30 * s.u), 8);
    },
  },
  {
    id: "park", name: "Park", alias: ["garden", "outside", "poonga"], swatch: ["#BDE0FE", "#95D5B2"],
    draw(ctx, s) {
      sky(ctx, s, "#A2D2FF", "#E0F4FF");
      cloud(ctx, s.W * 0.25 + Math.sin(s.t * 0.1) * 30, s.floor - 1050 * s.u, s.u);
      cloud(ctx, s.W * 0.78, s.floor - 900 * s.u, 0.7 * s.u);
      blob(ctx, "#B7E4C7", () => ellipse(ctx, s.W * 0.3, s.floor + 40, s.W * 0.6, 260 * s.u), 0);
      blob(ctx, "#95D5B2", () => ellipse(ctx, s.W * 0.8, s.floor + 40, s.W * 0.5, 200 * s.u), 0);
      tree(ctx, s.W * 0.08, s.floor, s.u * 1.1);
      tree(ctx, s.W * 0.94, s.floor, s.u * 0.9, "#52B788");
      ctx.fillStyle = "#74C69D";
      ctx.fillRect(-PAD, s.floor, s.W + PAD * 2, s.H - s.floor + PAD);
      ctx.strokeStyle = "rgba(30,27,46,0.25)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-PAD, s.floor);
      ctx.lineTo(s.W + PAD, s.floor);
      ctx.stroke();
    },
  },
  {
    id: "street", name: "Street", alias: ["road", "city", "theru"], swatch: ["#CDE7F0", "#6C757D"],
    draw(ctx, s) {
      sky(ctx, s, "#BDE0FE", "#FFF1E6");
      // Buildings in a row.
      const colors = ["#F4A261", "#E9C46A", "#84A59D", "#F28482", "#8ECAE6", "#CDB4DB"];
      const bw = 260 * s.u;
      let i = 0;
      for (let x = -bw; x < s.W + bw; x += bw, i++) {
        const h = (520 + ((i * 137) % 300)) * s.u;
        blob(ctx, colors[i % colors.length], () => ctx.rect(x, s.floor - h, bw - 12, h), 8);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        for (let wy = s.floor - h + 50 * s.u; wy < s.floor - 120 * s.u; wy += 120 * s.u) {
          for (const wx of [0.22, 0.6]) ctx.fillRect(x + bw * wx, wy, 50 * s.u, 60 * s.u);
        }
      }
      ctx.fillStyle = "#6C757D";
      ctx.fillRect(-PAD, s.floor, s.W + PAD * 2, s.H - s.floor + PAD);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-PAD, s.floor);
      ctx.lineTo(s.W + PAD, s.floor);
      ctx.stroke();
      ctx.fillStyle = "#F8F9FA";
      for (let x = -PAD; x < s.W + PAD; x += 220 * s.u) ctx.fillRect(x, s.floor + (s.H - s.floor) * 0.5, 120 * s.u, 14 * s.u);
    },
  },
  {
    id: "teashop", name: "Tea shop", alias: ["tea kadai", "kadai", "shop", "chai"], swatch: ["#FFE5B4", "#BC6C25"],
    draw(ctx, s) {
      walls(ctx, s, "#FEFAE0", "#D4A373");
      const y = s.floor - 960 * s.u;
      // The awning and the board.
      const w = 760 * s.u;
      for (let k = 0; k < 8; k++) {
        blob(ctx, k % 2 ? "#F1FAEE" : "#E63946", () => ctx.roundRect(s.W / 2 - w / 2 + (k * w) / 8, y, w / 8, 130 * s.u, [0, 0, 30 * s.u, 30 * s.u]), 6);
      }
      blob(ctx, "#283618", () => ctx.roundRect(s.W / 2 - 230 * s.u, y - 130 * s.u, 460 * s.u, 110 * s.u, 12), 8);
      label(ctx, "TEA ☕", s.W / 2, y - 74 * s.u, 70 * s.u, "#FEFAE0");
      // The counter, a kettle and glasses.
      blob(ctx, "#BC6C25", () => ctx.rect(s.W / 2 - 400 * s.u, s.floor - 280 * s.u, 800 * s.u, 280 * s.u), 8);
      blob(ctx, "#DDA15E", () => ctx.rect(s.W / 2 - 430 * s.u, s.floor - 310 * s.u, 860 * s.u, 40 * s.u), 8);
      blob(ctx, "#ADB5BD", () => ctx.roundRect(s.W / 2 - 60 * s.u, s.floor - 420 * s.u, 120 * s.u, 110 * s.u, 24 * s.u), 8);
      const puff = (s.t * 0.6) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - puff)})`;
      ctx.beginPath();
      circle(ctx, s.W / 2 + 10 * s.u, s.floor - (450 + puff * 120) * s.u, (18 + puff * 26) * s.u);
      ctx.fill();
    },
  },
  {
    id: "office", name: "Office", alias: ["work", "velai", "company"], swatch: ["#E9ECEF", "#ADB5BD"],
    draw(ctx, s) {
      walls(ctx, s, "#E9ECEF", "#ADB5BD");
      const y = s.floor - 900 * s.u;
      // A chart on the wall.
      blob(ctx, "#fff", () => ctx.roundRect(s.W / 2 - 250 * s.u, y - 150 * s.u, 500 * s.u, 300 * s.u, 14), 8);
      const bars = [0.35, 0.55, 0.45, 0.8, 0.95];
      bars.forEach((b, k) => blob(ctx, ["#8ECAE6", "#219EBC", "#FFB703", "#FB8500", "#E63946"][k], () => ctx.rect(s.W / 2 + (-190 + k * 80) * s.u, y + (120 - b * 220) * s.u, 56 * s.u, b * 220 * s.u), 6));
      // A desk and a laptop.
      blob(ctx, "#8D6E63", () => ctx.rect(s.W / 2 - 300 * s.u, s.floor - 260 * s.u, 600 * s.u, 30 * s.u), 8);
      blob(ctx, "#6D4C41", () => ctx.rect(s.W / 2 - 270 * s.u, s.floor - 230 * s.u, 540 * s.u, 230 * s.u), 8);
      blob(ctx, "#343A40", () => ctx.roundRect(s.W / 2 - 90 * s.u, s.floor - 380 * s.u, 180 * s.u, 120 * s.u, 10), 8);
    },
  },
  {
    id: "beach", name: "Beach", alias: ["sea", "kadal", "kadarkarai"], swatch: ["#90E0EF", "#F6E3B4"],
    draw(ctx, s) {
      sky(ctx, s, "#48CAE4", "#CAF0F8");
      blob(ctx, "#FFD166", () => circle(ctx, s.W * 0.78, s.floor - 950 * s.u, 90 * s.u), 8);
      cloud(ctx, s.W * 0.25, s.floor - 980 * s.u, 0.8 * s.u);
      // The sea, with a slow wave.
      ctx.fillStyle = "#0096C7";
      ctx.fillRect(-PAD, s.floor - 330 * s.u, s.W + PAD * 2, 340 * s.u);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 8 * s.u;
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = -PAD; x < s.W + PAD; x += 40) {
          const yy = s.floor - (280 - row * 90) * s.u + Math.sin(x * 0.012 + s.t * 1.2 + row) * 10 * s.u;
          if (x === -PAD) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#F6E3B4";
      ctx.fillRect(-PAD, s.floor, s.W + PAD * 2, s.H - s.floor + PAD);
      ctx.strokeStyle = "rgba(30,27,46,0.25)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-PAD, s.floor);
      ctx.lineTo(s.W + PAD, s.floor);
      ctx.stroke();
    },
  },
  {
    id: "terrace", name: "Terrace (evening)", alias: ["evening", "sunset", "maadi", "mottai maadi"], swatch: ["#FFB4A2", "#6D6875"],
    draw(ctx, s) {
      sky(ctx, s, "#6D6875", "#FFCDB2");
      blob(ctx, "#FFB703", () => circle(ctx, s.W / 2, s.floor - 420 * s.u, 130 * s.u), 0);
      // Far roofs, then the parapet wall.
      ctx.fillStyle = "#5A5766";
      for (let x = -PAD, k = 0; x < s.W + PAD; x += 190 * s.u, k++) ctx.fillRect(x, s.floor - (360 + ((k * 97) % 170)) * s.u, 170 * s.u, 400 * s.u);
      blob(ctx, "#B5838D", () => ctx.rect(-PAD, s.floor - 250 * s.u, s.W + PAD * 2, 250 * s.u), 8);
      blob(ctx, "#E5989B", () => ctx.rect(-PAD, s.floor - 280 * s.u, s.W + PAD * 2, 36 * s.u), 8);
      ctx.fillStyle = "#9D8189";
      ctx.fillRect(-PAD, s.floor, s.W + PAD * 2, s.H - s.floor + PAD);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-PAD, s.floor);
      ctx.lineTo(s.W + PAD, s.floor);
      ctx.stroke();
    },
  },
  {
    id: "hospital", name: "Clinic", alias: ["hospital", "doctor", "maruthuvamanai"], swatch: ["#E8F7F2", "#A8DADC"],
    draw(ctx, s) {
      walls(ctx, s, "#E8F7F2", "#A8DADC");
      const y = s.floor - 900 * s.u;
      blob(ctx, "#fff", () => ctx.roundRect(s.W / 2 - 130 * s.u, y - 130 * s.u, 260 * s.u, 260 * s.u, 30 * s.u), 8);
      blob(ctx, "#E63946", () => {
        ctx.rect(s.W / 2 - 34 * s.u, y - 90 * s.u, 68 * s.u, 180 * s.u);
        ctx.rect(s.W / 2 - 90 * s.u, y - 34 * s.u, 180 * s.u, 68 * s.u);
      }, 0);
      blob(ctx, "#F1FAEE", () => ctx.roundRect(s.W / 2 - 360 * s.u, s.floor - 220 * s.u, 720 * s.u, 60 * s.u, 20 * s.u), 8);
      for (const side of [-1, 1]) blob(ctx, "#ADB5BD", () => ctx.rect(s.W / 2 + side * 320 * s.u - 10 * s.u, s.floor - 160 * s.u, 20 * s.u, 160 * s.u), 6);
    },
  },
  ...(
    [["sunny", "Sunny yellow", "#FFD166", "#F4A261"], ["mint", "Mint", "#B8F2E6", "#5FC9B5"], ["candy", "Candy pink", "#FFC8DD", "#FF8FAB"], ["grape", "Grape", "#CDB4DB", "#9D4EDD"]] as const
  ).map(([id, name, wall, ground]): Background => ({
    id, name, alias: [], swatch: [wall, ground],
    draw(ctx, s) {
      walls(ctx, s, wall, ground);
      // Soft dots, so a flat colour still feels drawn.
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let k = 0; k < 14; k++) {
        ctx.beginPath();
        circle(ctx, ((k * 277) % 1000) / 1000 * s.W, ((k * 419) % 1000) / 1000 * s.floor, (20 + ((k * 53) % 40)) * s.u);
        ctx.fill();
      }
    },
  })),
];

/** The background a script names, by id, name or another word for it. */
export function findBackground(word: string): Background | undefined {
  const w = word.trim().toLowerCase();
  if (!w) return undefined;
  return BACKGROUNDS.find((b) => b.id === w || b.name.toLowerCase() === w || b.alias.includes(w))
    ?? BACKGROUNDS.find((b) => b.name.toLowerCase().includes(w) || b.alias.some((a) => a.includes(w)));
}

export const backgroundById = (id: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
