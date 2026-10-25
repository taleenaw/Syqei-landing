/**
 * A classic, training-free object detector.
 * It doesn't know what a moth is. It scans the image for the patch most unlike
 * its surroundings in brightness, colour, edges and grain direction
 * (centre-surround saliency with a structure tensor), then boxes the best
 * candidates with a confidence score.
 */

export type Detection = {
  /** Best guess, in source image pixels. */
  x: number;
  y: number;
  /** How long the detector took, measured, in milliseconds. */
  ms: number;
  /** Score map scaled 0 to 1, size heatW x heatH. */
  heat: Float32Array;
  heatW: number;
  heatH: number;
  /** Strongest separate candidates, best first, with a 0 to 1 confidence. */
  candidates: { x: number; y: number; confidence: number; angle: number }[];
  /** Intermediate images the detector worked from, for showing its steps. */
  maps: Maps;
};

/** Small working images: brightness, edge strength and grain direction. */
export type Maps = { w: number; h: number; L: Float32Array; E: Float32Array; C: Float32Array; S: Float32Array };

/** How much each feature counts. sq rewards being unusual either way, lin rewards one direction. */
export type Weights = { sq: number[]; lin: number[]; shape?: number };

/** A shape to look for: outline points at size 1, centred on 0,0. */
export type Outline = [number, number][];

const ANGLES = 12;

/**
 * Template matching. At every spot and at 12 rotations, trace the outline and
 * measure how strongly the image has an edge running along it, compared with
 * just inside and just outside. Busy textures have edges everywhere, so only
 * a clean edge that follows the whole shape scores well.
 */
function shapeScore(f: Features, outline: Outline, size: number) {
  const { w, h, L } = f.maps;
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      gy[i] = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
    }
  }
  const s = size / SCALE;
  // Precompute rotated outline points and their outward normals.
  const rot = Array.from({ length: ANGLES }, (_, a) => {
    const th = (a / ANGLES) * Math.PI * 2;
    const c = Math.cos(th);
    const si = Math.sin(th);
    return outline.map(([x, y], i) => {
      const [nx0, ny0] = outline[(i + 1) % outline.length];
      const [px0, py0] = outline[(i - 1 + outline.length) % outline.length];
      let tx = nx0 - px0;
      let ty = ny0 - py0;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = ty;
      const ny = -tx;
      return {
        x: (x * c - y * si) * s,
        y: (x * si + y * c) * s,
        nx: nx * c - ny * si,
        ny: nx * si + ny * c,
      };
    });
  });
  const out = new Float32Array(f.gw * f.gh);
  const angle = new Uint8Array(f.gw * f.gh);
  const mag = (x: number, y: number) => {
    const i = (Math.round(y) * w + Math.round(x)) | 0;
    return Math.hypot(gx[i], gy[i]);
  };
  for (let gyi = 0; gyi < f.gh; gyi++) {
    for (let gxi = 0; gxi < f.gw; gxi++) {
      const k = gyi * f.gw + gxi;
      if (!f.valid[k]) continue;
      const cx = gxi * STEP;
      const cy = gyi * STEP;
      let best = -Infinity;
      let bestA = 0;
      for (let a = 0; a < ANGLES; a++) {
        let on = 0;
        let off = 0;
        for (const p of rot[a]) {
          const x = cx + p.x;
          const y = cy + p.y;
          const i = (Math.round(y) * w + Math.round(x)) | 0;
          // Edge across the outline, not along it.
          on += Math.abs(gx[i] * p.nx + gy[i] * p.ny);
          off += mag(x + p.nx * 2.5, y + p.ny * 2.5) + mag(x - p.nx * 2.5, y - p.ny * 2.5);
        }
        const sc = (on - 0.5 * off) / rot[a].length;
        if (sc > best) {
          best = sc;
          bestA = a;
        }
      }
      out[k] = best;
      angle[k] = bestA;
    }
  }
  return { out, angle };
}

const SCALE = 4;
const STEP = 2;

/** Summed-area table so any box mean costs four lookups. */
function integral(src: Float32Array, w: number, h: number) {
  const out = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      out[(y + 1) * (w + 1) + x + 1] = out[y * (w + 1) + x + 1] + row;
    }
  }
  return out;
}

function boxMean(ii: Float64Array, w: number, x0: number, y0: number, x1: number, y1: number) {
  const W = w + 1;
  return (ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
}

export type Features = {
  /** Feature-major: values[f][k] for grid point k. Already standardised per image. */
  values: Float32Array[];
  valid: Uint8Array;
  gw: number;
  gh: number;
  maps: Maps;
};

/** Number of base features (before squaring). */
export const BASE_FEATURES = 15;

/** Compute standardised features on a grid across the image. */
export function extractFeatures(source: HTMLCanvasElement, targetSize: number): Features {
  const w = Math.floor(source.width / SCALE);
  const h = Math.floor(source.height / SCALE);
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(source, 0, 0, w, h);
  const px = sctx.getImageData(0, 0, w, h).data;

  const n = w * h;
  const L = new Float32Array(n);
  const A = new Float32Array(n);
  const B = new Float32Array(n);
  const L2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255;
    const g = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    L2[i] = L[i] * L[i];
    A[i] = r - g;
    B[i] = (r + g) / 2 - b;
  }
  // Gradients, then the structure tensor: how strong the grain is and which way it runs.
  const C = new Float32Array(n);
  const S = new Float32Array(n);
  const E = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
      C[i] = gx * gx - gy * gy;
      S[i] = 2 * gx * gy;
      E[i] = gx * gx + gy * gy;
    }
  }
  const T = [L, A, B, C, S, E, L2].map((m) => integral(m, w, h));

  const rIn = Math.max(2, Math.round((targetSize * 0.4) / SCALE));
  const rMid = Math.max(3, Math.round((targetSize * 0.75) / SCALE));
  const rOut = Math.round(rMid * 2) + 2;
  const gw = Math.floor(w / STEP);
  const gh = Math.floor(h / STEP);
  const values = Array.from({ length: BASE_FEATURES }, () => new Float32Array(gw * gh));
  const valid = new Uint8Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const cx = gx * STEP;
      const cy = gy * STEP;
      if (cx - rOut < 0 || cy - rOut < 0 || cx + rOut + 1 > w || cy + rOut + 1 > h) continue;
      const k = gy * gw + gx;
      valid[k] = 1;
      const mean = (t: number, r: number) => boxMean(T[t], w, cx - r, cy - r, cx + r + 1, cy + r + 1);
      let f = 0;
      // Centre against surroundings, at two sizes, for brightness, colour and grain.
      for (const t of [0, 1, 2, 3, 4, 5]) {
        const inner = mean(t, rMid);
        const outer = mean(t, rOut);
        values[f++][k] = inner - outer;
      }
      for (const t of [0, 3, 4, 5]) values[f++][k] = mean(t, rIn) - mean(t, rMid);
      // Texture busyness, and how directional the grain is, right here.
      const lv = mean(6, rMid) - mean(0, rMid) ** 2;
      values[f++][k] = lv;
      const c = mean(3, rMid);
      const s = mean(4, rMid);
      const e = mean(5, rMid) + 1e-9;
      values[f++][k] = Math.hypot(c, s) / e;
      const co = mean(3, rOut);
      const so = mean(4, rOut);
      const eo = mean(5, rOut) + 1e-9;
      // Does the grain here run the same way as the grain around it?
      values[f++][k] = (c * co + s * so) / (e * eo);
      values[f++][k] = Math.hypot(co, so) / eo;
      values[f++][k] = e / eo;
    }
  }

  // Standardise each feature within this image so backgrounds are comparable.
  for (const v of values) {
    let sum = 0;
    let sq = 0;
    let count = 0;
    for (let k = 0; k < v.length; k++) {
      if (!valid[k]) continue;
      sum += v[k];
      sq += v[k] * v[k];
      count++;
    }
    const m = sum / count;
    const sd = Math.sqrt(Math.max(1e-12, sq / count - m * m));
    for (let k = 0; k < v.length; k++) v[k] = valid[k] ? (v[k] - m) / sd : 0;
  }
  return { values, valid, gw, gh, maps: { w, h, L, E, C, S } };
}

/**
 * Hand-tuned weights. Negative brightness terms favour the darker, banded wing;
 * the grain terms favour a patch whose grain runs a different way from its surroundings.
 */
export const DEFAULT_WEIGHTS: Weights = {
  sq: [0.22, 0.48, 1.19, 0.82, 0.63, 0.28, 0.13, 0.01, 0.26, 0, 0, 0, 0, 0.34, 0.42],
  lin: [-1.41, -0.46, 0.44, -1.42, 1.35, -2.42, -1.96, 0.4, 1.15, -0.4, -1, -2.09, -1.42, -1.07, 1.23],
};

/** Run the detector. The timing covers everything from pixels to best guess. */
export function detect(
  source: HTMLCanvasElement,
  targetSize: number,
  outline?: Outline,
  weights: Weights = DEFAULT_WEIGHTS,
): Detection {
  const start = performance.now();
  const f = extractFeatures(source, targetSize);
  const n = f.gw * f.gh;
  const raw = new Float32Array(n);
  let shapeAngle: Uint8Array | null = null;
  if (outline && weights.shape) {
    const { out, angle } = shapeScore(f, outline, targetSize);
    shapeAngle = angle;
    let sum = 0;
    let sq = 0;
    let c = 0;
    for (let k = 0; k < n; k++) {
      if (!f.valid[k]) continue;
      sum += out[k];
      sq += out[k] * out[k];
      c++;
    }
    const m = sum / c;
    const sd = Math.sqrt(Math.max(1e-12, sq / c - m * m));
    for (let k = 0; k < n; k++) if (f.valid[k]) raw[k] += weights.shape * ((out[k] - m) / sd);
  }
  f.values.forEach((v, i) => {
    const a = weights.sq[i] ?? 0;
    const b = weights.lin[i] ?? 0;
    if (!a && !b) return;
    for (let k = 0; k < n; k++) raw[k] += a * v[k] * v[k] + b * v[k];
  });
  // Smooth so one lucky spot doesn't win over a whole moth-sized region.
  const score = new Float32Array(n);
  for (let y = 1; y < f.gh - 1; y++) {
    for (let x = 1; x < f.gw - 1; x++) {
      const k = y * f.gw + x;
      if (f.valid[k]) score[k] = (raw[k] * 4 + raw[k - 1] + raw[k + 1] + raw[k - f.gw] + raw[k + f.gw]) / 8;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < n; k++) {
    if (!f.valid[k]) continue;
    if (score[k] < min) min = score[k];
    if (score[k] > max) max = score[k];
  }
  const heat = new Float32Array(n);
  for (let k = 0; k < n; k++) heat[k] = f.valid[k] ? (score[k] - min) / (max - min || 1) : 0;

  // Non-maximum suppression: take the best spot, rule out its neighbourhood, repeat.
  const toPx = (k: number) => ({ x: ((k % f.gw) * STEP + 0.5) * SCALE, y: (Math.floor(k / f.gw) * STEP + 0.5) * SCALE });
  const order = Array.from({ length: n }, (_, k) => k)
    .filter((k) => f.valid[k])
    .sort((a, b) => score[b] - score[a]);
  const picks: { x: number; y: number; s: number; angle: number }[] = [];
  for (const k of order) {
    const p = toPx(k);
    if (picks.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < targetSize * 1.6)) continue;
    picks.push({ ...p, s: heat[k], angle: shapeAngle ? (shapeAngle[k] / ANGLES) * Math.PI * 2 : 0 });
    if (picks.length === 5) break;
  }
  // Confidence: how far the winner stands above the runners-up.
  const total = picks.reduce((t, p) => t + Math.exp(6 * p.s), 0);
  const candidates = picks.map((p) => ({ x: p.x, y: p.y, angle: p.angle, confidence: Math.exp(6 * p.s) / total }));
  return {
    x: candidates[0].x,
    y: candidates[0].y,
    ms: performance.now() - start,
    heat,
    heatW: f.gw,
    heatH: f.gh,
    candidates,
    maps: f.maps,
  };
}

/** Paint a score map over a canvas, purple to lime. */
export function paintHeat(ctx: CanvasRenderingContext2D, det: Detection, w: number, h: number) {
  const tmp = document.createElement("canvas");
  tmp.width = det.heatW;
  tmp.height = det.heatH;
  const tctx = tmp.getContext("2d")!;
  const img = tctx.createImageData(det.heatW, det.heatH);
  for (let k = 0; k < det.heat.length; k++) {
    const v = Math.pow(det.heat[k], 1.6);
    img.data[k * 4] = 82 + (203 - 82) * v;
    img.data[k * 4 + 1] = 42 + (222 - 42) * v;
    img.data[k * 4 + 2] = 112 + (121 - 112) * v;
    img.data[k * 4 + 3] = 40 + 190 * v;
  }
  tctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, w, h);
  ctx.restore();
}
