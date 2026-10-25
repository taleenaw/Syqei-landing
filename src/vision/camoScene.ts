/**
 * Procedural camouflage scenes for detection games.
 * Every scene is drawn from a seed, so the same seed always gives the same
 * pixels. That lets a person and a detector be tested on identical images.
 */

export type Backdrop = "bark" | "litter" | "lichen" | "gravel";

export const BACKDROP_LABELS: Record<Backdrop, string> = {
  bark: "Tree bark",
  litter: "Leaf litter",
  lichen: "Lichen rock",
  gravel: "Gravel",
};

export type SceneSpec = {
  backdrop: Backdrop;
  /** 0 is easy to spot, 1 is as hidden as the generator can make it. */
  difficulty: number;
  seed: number;
};

/** Where the target ended up, in canvas pixels. */
export type Target = { x: number; y: number; r: number; angle: number };

export const SCENE_W = 960;
export const SCENE_H = 600;

export function isBackdrop(v: unknown): v is Backdrop {
  return typeof v === "string" && v in BACKDROP_LABELS;
}

/** Small fast seeded random number generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, list: T[]) => list[Math.floor(r() * list.length)];
const between = (r: Rand, a: number, b: number) => a + r() * (b - a);

const PALETTES: Record<Backdrop, { base: string; tones: string[]; dark: string; light: string }> = {
  bark: { base: "#5e5448", tones: ["#6f6556", "#4a4239", "#7d7262", "#574e43", "#8a806d"], dark: "#2b251f", light: "#a39a86" },
  litter: { base: "#3b2a1c", tones: ["#8a5a2b", "#a8743c", "#6b4424", "#b98c52", "#5a3a20", "#7e6a3d"], dark: "#24170e", light: "#d0a86a" },
  lichen: { base: "#6a6d63", tones: ["#9aa58a", "#b8bba5", "#7f8774", "#c9c3a0", "#5c6155"], dark: "#33362f", light: "#dcd9c4" },
  gravel: { base: "#a08f74", tones: ["#b5a286", "#8a7a62", "#c4b496", "#776953", "#9c8a6d"], dark: "#4d4334", light: "#e0d2b4" },
};

function leafPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.quadraticCurveTo(0, -wid, len / 2, 0);
  ctx.quadraticCurveTo(0, wid, -len / 2, 0);
  ctx.closePath();
}

function blob(ctx: CanvasRenderingContext2D, r: Rand, x: number, y: number, rad: number) {
  const n = 9;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = rad * between(r, 0.65, 1.2);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Fill the whole canvas with a backdrop texture. */
function paintBackdrop(ctx: CanvasRenderingContext2D, kind: Backdrop, r: Rand, w: number, h: number) {
  const p = PALETTES[kind];
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, w, h);

  if (kind === "bark") {
    for (let i = 0; i < 260; i++) {
      const x = r() * w;
      const width = between(r, 2, 10);
      ctx.strokeStyle = pick(r, p.tones);
      ctx.globalAlpha = between(r, 0.5, 0.95);
      ctx.lineWidth = width;
      ctx.beginPath();
      let y = -20;
      let cx = x;
      ctx.moveTo(cx, y);
      while (y < h + 20) {
        y += between(r, 18, 40);
        cx += between(r, -5, 5);
        ctx.lineTo(cx, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = p.dark;
    for (let i = 0; i < 46; i++) {
      ctx.globalAlpha = between(r, 0.5, 0.9);
      ctx.lineWidth = between(r, 1.5, 4.5);
      let x = r() * w;
      let y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 4 + Math.floor(r() * 8);
      for (let s = 0; s < steps; s++) {
        x += between(r, -6, 6);
        y += between(r, 14, 30);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = between(r, 0.25, 0.6);
      ctx.fillStyle = pick(r, ["#8f9677", "#a7a98c", p.light]);
      blob(ctx, r, r() * w, r() * h, between(r, 4, 16));
      ctx.fill();
    }
  }

  if (kind === "litter") {
    for (let i = 0; i < Math.round((w * h) / 1000); i++) {
      const x = r() * w;
      const y = r() * h;
      const len = between(r, 36, 96);
      const wid = len * between(r, 0.25, 0.45);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r() * Math.PI * 2);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = p.dark;
      ctx.translate(3, 4);
      leafPath(ctx, len, wid);
      ctx.fill();
      ctx.translate(-3, -4);
      ctx.globalAlpha = 1;
      const tone = pick(r, p.tones);
      const g = ctx.createLinearGradient(0, -wid, 0, wid);
      g.addColorStop(0, tone);
      g.addColorStop(1, p.dark);
      ctx.fillStyle = r() < 0.5 ? g : tone;
      leafPath(ctx, len, wid);
      ctx.fill();
      ctx.strokeStyle = r() < 0.5 ? p.light : p.dark;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (kind === "lichen") {
    for (let i = 0; i < 520; i++) {
      ctx.globalAlpha = between(r, 0.4, 0.95);
      ctx.fillStyle = pick(r, p.tones);
      blob(ctx, r, r() * w, r() * h, between(r, 5, 26));
      ctx.fill();
    }
    for (let i = 0; i < 900; i++) {
      ctx.globalAlpha = between(r, 0.3, 0.8);
      ctx.fillStyle = r() < 0.6 ? p.dark : p.light;
      ctx.fillRect(r() * w, r() * h, between(r, 1, 3), between(r, 1, 3));
    }
  }

  if (kind === "gravel") {
    for (let i = 0; i < 1100; i++) {
      const x = r() * w;
      const y = r() * h;
      const rx = between(r, 4, 14);
      const ry = rx * between(r, 0.55, 0.95);
      const rot = r() * Math.PI;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = p.dark;
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 2.5, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pick(r, p.tones);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

type Pt = [number, number];
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** The moth's outline as points, at size 1, for shape matching. */
export function targetOutline(): Pt[] {
  return [
    ...cubic([0, -0.42], [0.25, -0.4], [0.75, 0.05], [0.98, 0.32], 10),
    ...cubic([0.98, 0.32], [0.8, 0.44], [0.42, 0.5], [0.14, 0.56], 7),
    [0.07, 0.53],
    ...cubic([-0.14, 0.56], [-0.42, 0.5], [-0.8, 0.44], [-0.98, 0.32], 7),
    ...cubic([-0.98, 0.32], [-0.75, 0.05], [-0.25, -0.4], [0, -0.42], 10),
  ];
}

/** A resting moth seen from above, wings folded back into a delta. Centred on 0,0. */
function mothPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -0.42 * s);
  ctx.bezierCurveTo(0.25 * s, -0.4 * s, 0.75 * s, 0.05 * s, 0.98 * s, 0.32 * s);
  ctx.bezierCurveTo(0.8 * s, 0.44 * s, 0.42 * s, 0.5 * s, 0.14 * s, 0.56 * s);
  ctx.lineTo(0, 0.5 * s);
  ctx.lineTo(-0.14 * s, 0.56 * s);
  ctx.bezierCurveTo(-0.42 * s, 0.5 * s, -0.8 * s, 0.44 * s, -0.98 * s, 0.32 * s);
  ctx.bezierCurveTo(-0.75 * s, 0.05 * s, -0.25 * s, -0.4 * s, 0, -0.42 * s);
  ctx.closePath();
}

/**
 * Moth wing patterns in the background's colours. Most get disruptive bands and
 * speckles, like real bark and lichen moths. On leaf litter the moth mimics a
 * dead leaf, with a midrib running across both wings, like Eudocima.
 */
function paintWings(ctx: CanvasRenderingContext2D, kind: Backdrop, r: Rand, s: number) {
  const p = PALETTES[kind];
  const base = pick(r, p.tones);
  const g = ctx.createLinearGradient(0, -0.4 * s, 0, 0.6 * s);
  g.addColorStop(0, p.light);
  g.addColorStop(0.35, base);
  g.addColorStop(1, p.dark);
  ctx.fillStyle = base;
  ctx.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
  ctx.globalAlpha = 1;

  if (kind === "litter") {
    // One leaf drawn across both wings. A midrib and side veins.
    ctx.strokeStyle = p.light;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-0.95 * s, 0.32 * s);
    ctx.quadraticCurveTo(0, -0.05 * s, 0.7 * s, -0.05 * s);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + i * 0.12;
      const x = -0.95 * s + t * 1.65 * s;
      const y = 0.32 * s - t * 0.37 * s - Math.sin(t * Math.PI) * 0.12 * s;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.14 * s, y + side * 0.2 * s);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Wavy cross bands, the way real moth patterns break up their outline.
  ctx.strokeStyle = p.dark;
  for (let band = 0; band < 3; band++) {
    const y0 = (-0.15 + band * 0.22) * s;
    ctx.globalAlpha = between(r, 0.45, 0.8);
    ctx.lineWidth = between(r, 0.04, 0.09) * s;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const x = -s + (i / 14) * 2 * s;
      const y = y0 + Math.abs(x) * 0.35 + Math.sin(i * 1.7 + band) * 0.04 * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = between(r, 0.3, 0.8);
    ctx.fillStyle = r() < 0.6 ? p.dark : p.light;
    const rad = between(r, 0.01, 0.035) * s;
    ctx.beginPath();
    ctx.arc(between(r, -s, s), between(r, -0.4 * s, 0.6 * s), rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // A pale patch near each wing tip.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = p.light;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 0.6 * s, 0.22 * s, 0.12 * s, 0.07 * s, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function grain(ctx: CanvasRenderingContext2D, r: Rand, w: number, h: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Draw a full scene into ctx (which must be SCENE_W x SCENE_H) and return
 * where the moth is. The moth is painted with a second sample of the same
 * texture, rotated with its body, so its pattern matches the background
 * but its edges and grain direction don't line up.
 */
export function drawScene(ctx: CanvasRenderingContext2D, spec: SceneSpec): Target {
  const w = SCENE_W;
  const h = SCENE_H;
  const d = Math.max(0, Math.min(1, spec.difficulty));
  const r = rng(spec.seed);

  paintBackdrop(ctx, spec.backdrop, rng(spec.seed * 7 + 1), w, h);

  const s = between(r, 46, 60) - d * 6;
  const margin = s * 1.3;
  const target: Target = {
    x: between(r, margin, w - margin),
    y: between(r, margin, h - margin),
    r: s,
    angle: r() * Math.PI * 2,
  };

  // A second sample of the same backdrop becomes the wing pattern.
  // It's painted at full size so its grain and density match the background exactly.
  const tex = document.createElement("canvas");
  tex.width = w;
  tex.height = h;
  const tctx = tex.getContext("2d")!;
  paintBackdrop(tctx, spec.backdrop, rng(spec.seed * 13 + 5), w, h);
  const crop = Math.ceil(s * 2.2);
  const sx = between(r, 0, w - crop);
  const sy = between(r, 0, h - crop);

  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.rotate(target.angle);

  // Contact shadow. Real moths sit slightly off the surface.
  ctx.save();
  ctx.translate(2, 4);
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.12 + 0.35 * (1 - d);
  ctx.fillStyle = "#000";
  mothPath(ctx, s);
  ctx.fill();
  ctx.restore();

  ctx.save();
  mothPath(ctx, s);
  ctx.clip();
  paintWings(ctx, spec.backdrop, r, s);
  // Harder rounds blend in a sample of the real background over the wing pattern.
  ctx.globalAlpha = 0.15 + 0.55 * d;
  ctx.drawImage(tex, sx, sy, crop, crop, -crop / 2, -crop / 2, crop, crop);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Body.
  ctx.globalAlpha = 0.18 + 0.3 * (1 - d);
  ctx.fillStyle = PALETTES[spec.backdrop].dark;
  ctx.beginPath();
  ctx.ellipse(0, 0.04 * s, 0.07 * s, 0.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Edge. Almost gone on the hardest rounds.
  ctx.globalAlpha = 0.06 + 0.4 * (1 - d);
  ctx.strokeStyle = PALETTES[spec.backdrop].dark;
  ctx.lineWidth = 1.2;
  mothPath(ctx, s);
  ctx.stroke();
  ctx.restore();

  // Soft light falloff and sensor grain over everything, moth included.
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, rng(spec.seed * 3 + 2), w, h, 18);

  return target;
}

/** True when a point lands on the target (with a little forgiveness). */
export function hits(t: Target, x: number, y: number) {
  return Math.hypot(x - t.x, y - t.y) <= t.r * 0.9;
}
