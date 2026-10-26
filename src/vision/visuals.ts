/**
 * Ways to show what a detector is looking at, drawn onto a canvas.
 * Each one turns one of the detector's working images into a picture.
 */
import type { Detection, Maps } from "./detect";

function blit(ctx: CanvasRenderingContext2D, maps: Maps, w: number, h: number, pixel: (i: number, out: Uint8ClampedArray, o: number) => void) {
  const tmp = document.createElement("canvas");
  tmp.width = maps.w;
  tmp.height = maps.h;
  const tctx = tmp.getContext("2d")!;
  const img = tctx.createImageData(maps.w, maps.h);
  for (let i = 0; i < maps.w * maps.h; i++) pixel(i, img.data, i * 4);
  tctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tmp, 0, 0, w, h);
  ctx.restore();
}

/** Brightness only. What the detector starts from. */
export function paintGrey(ctx: CanvasRenderingContext2D, maps: Maps, w: number, h: number) {
  blit(ctx, maps, w, h, (i, d, o) => {
    const v = Math.min(255, maps.L[i] * 300);
    d[o] = d[o + 1] = d[o + 2] = v;
    d[o + 3] = 255;
  });
}

/** Edge strength, drawn like an x-ray: dark background, glowing cyan-white edges. */
export function paintEdges(ctx: CanvasRenderingContext2D, maps: Maps, w: number, h: number) {
  let max = 0;
  for (let i = 0; i < maps.E.length; i++) if (maps.E[i] > max) max = maps.E[i];
  const scale = 1 / Math.sqrt(max * 0.25 || 1);
  blit(ctx, maps, w, h, (i, d, o) => {
    const v = Math.min(1, Math.sqrt(maps.E[i]) * scale);
    d[o] = 20 + 160 * v * v;
    d[o + 1] = 10 + 230 * v;
    d[o + 2] = 40 + 215 * v;
    d[o + 3] = 255;
  });
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

/** Grain direction in false colour. Hue is the angle, brightness is how strong the grain is. */
export function paintGrain(ctx: CanvasRenderingContext2D, maps: Maps, w: number, h: number) {
  // Average the structure tensor a little so the colours read as regions, not noise.
  const { w: mw, h: mh, C, S, E } = maps;
  const c2 = new Float32Array(C.length);
  const s2 = new Float32Array(S.length);
  const e2 = new Float32Array(E.length);
  const r = 2;
  for (let y = r; y < mh - r; y++) {
    for (let x = r; x < mw - r; x++) {
      let a = 0;
      let b = 0;
      let e = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const j = (y + dy) * mw + x + dx;
          a += C[j];
          b += S[j];
          e += E[j];
        }
      }
      const i = y * mw + x;
      c2[i] = a;
      s2[i] = b;
      e2[i] = e;
    }
  }
  let max = 0;
  for (let i = 0; i < e2.length; i++) if (e2[i] > max) max = e2[i];
  blit(ctx, maps, w, h, (i, d, o) => {
    const angle = (Math.atan2(s2[i], c2[i]) / (2 * Math.PI) + 1) % 1;
    const strength = Math.min(1, Math.sqrt(e2[i] / (max * 0.3 || 1)));
    const coherence = e2[i] ? Math.hypot(c2[i], s2[i]) / e2[i] : 0;
    const [R, G, B] = hsv(angle, 0.75, 0.15 + 0.85 * strength * (0.4 + 0.6 * coherence));
    d[o] = R;
    d[o + 1] = G;
    d[o + 2] = B;
    d[o + 3] = 255;
  });
}

/** The detector's score map, revealed down to the scan line. */
export function paintScan(ctx: CanvasRenderingContext2D, det: Detection, w: number, h: number, progress: number) {
  const tmp = document.createElement("canvas");
  tmp.width = det.heatW;
  tmp.height = det.heatH;
  const tctx = tmp.getContext("2d")!;
  const img = tctx.createImageData(det.heatW, det.heatH);
  const rows = Math.floor(det.heatH * progress);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < det.heatW; x++) {
      const k = y * det.heatW + x;
      const v = Math.pow(det.heat[k], 2.2);
      img.data[k * 4] = 82 + (203 - 82) * v;
      img.data[k * 4 + 1] = 42 + (222 - 42) * v;
      img.data[k * 4 + 2] = 112 + (121 - 112) * v;
      img.data[k * 4 + 3] = 70 + 180 * v;
    }
  }
  tctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, w, h);
  const y = h * progress;
  const g = ctx.createLinearGradient(0, y - 40, 0, y);
  g.addColorStop(0, "rgba(203,222,121,0)");
  g.addColorStop(1, "rgba(203,222,121,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y - 40, w, 40);
  ctx.strokeStyle = "#cbde79";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.restore();
}

/** A labelled detection box, like the ones object detectors draw. */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  label: string,
  color: string,
  opts: { dashed?: boolean; width?: number } = {},
) {
  const half = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.width ?? 3;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  if (opts.dashed) ctx.setLineDash([8, 6]);
  ctx.strokeRect(x - half, y - half, half * 2, half * 2);
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.font = "600 15px Sora Variable, Sora, system-ui, sans-serif";
  const tw = ctx.measureText(label).width + 12;
  const ty = Math.max(0, y - half - 24);
  ctx.fillStyle = color;
  ctx.fillRect(x - half - (opts.width ?? 3) / 2, ty, tw, 24);
  ctx.fillStyle = "#14032a";
  ctx.fillText(label, x - half + 5, ty + 17);
  ctx.restore();
}

export type Views = { grey: HTMLCanvasElement; edges: HTMLCanvasElement; grain: HTMLCanvasElement };

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Box blur via a summed-area table. Fast at any radius. */
function blur(src: Float32Array, w: number, h: number, r: number) {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const W = w + 1;
      out[y * w + x] = (ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * Full-resolution pictures of what the detector looks at, for showing on screen.
 * The detector itself works on a smaller copy for speed; these are just for people.
 */
export function buildViews(source: HTMLCanvasElement): Views {
  const w = source.width;
  const h = source.height;
  const px = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  // Light denoise so edges read as structure, not sensor grain.
  const Ls = blur(L, w, h, 1);
  const E = new Float32Array(n);
  const C = new Float32Array(n);
  const S = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = Ls[i - w + 1] + 2 * Ls[i + 1] + Ls[i + w + 1] - Ls[i - w - 1] - 2 * Ls[i - 1] - Ls[i + w - 1];
      const gy = Ls[i + w - 1] + 2 * Ls[i + w] + Ls[i + w + 1] - Ls[i - w - 1] - 2 * Ls[i - w] - Ls[i - w + 1];
      E[i] = Math.sqrt(gx * gx + gy * gy);
      C[i] = gx * gx - gy * gy;
      S[i] = 2 * gx * gy;
    }
  }

  // Greyscale with a little extra contrast.
  const grey = canvasOf(w, h);
  const gctx = grey.getContext("2d")!;
  const gi = gctx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, (L[i] - 0.5) * 1.35 * 255 + 128));
    gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v;
    gi.data[i * 4 + 3] = 255;
  }
  gctx.putImageData(gi, 0, 0);

  // Edges as an x-ray: normalise to the 98th percentile so a few strong edges don't wash it out.
  const sample = Array.from({ length: 4000 }, (_, k) => E[Math.floor((k / 4000) * n)]).sort((a, b) => a - b);
  const p98 = sample[Math.floor(sample.length * 0.98)] || 1;
  const edges = canvasOf(w, h);
  const ectx = edges.getContext("2d")!;
  const ei = ectx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.min(1, E[i] / p98);
    const v2 = v * v;
    ei.data[i * 4] = 8 + 150 * v2;
    ei.data[i * 4 + 1] = 6 + 225 * v;
    ei.data[i * 4 + 2] = 28 + 227 * Math.sqrt(v);
    ei.data[i * 4 + 3] = 255;
  }
  ectx.putImageData(ei, 0, 0);
  // A soft glow on top, like a scanner screen.
  ectx.save();
  ectx.globalCompositeOperation = "lighter";
  ectx.globalAlpha = 0.45;
  ectx.filter = "blur(4px)";
  ectx.drawImage(edges, 0, 0);
  ectx.restore();

  // Grain direction in false colour, smoothed so regions read clearly.
  const Cb = blur(C, w, h, 6);
  const Sb = blur(S, w, h, 6);
  const Eb = blur(
    E.map((e) => e * e),
    w,
    h,
    6,
  );
  const sample2 = Array.from({ length: 4000 }, (_, k) => Eb[Math.floor((k / 4000) * n)]).sort((a, b) => a - b);
  const q = sample2[Math.floor(sample2.length * 0.95)] || 1;
  const grain = canvasOf(w, h);
  const rctx = grain.getContext("2d")!;
  const ri = rctx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    const angle = (Math.atan2(Sb[i], Cb[i]) / (2 * Math.PI) + 1) % 1;
    const strength = Math.min(1, Math.sqrt(Eb[i] / q));
    const coherence = Eb[i] ? Math.min(1, Math.hypot(Cb[i], Sb[i]) / Eb[i]) : 0;
    const [R, G, B] = hsv(angle, 0.7, 0.12 + 0.88 * strength * (0.35 + 0.65 * coherence));
    ri.data[i * 4] = R;
    ri.data[i * 4 + 1] = G;
    ri.data[i * 4 + 2] = B;
    ri.data[i * 4 + 3] = 255;
  }
  rctx.putImageData(ri, 0, 0);
  // Fine edge detail over the colour, so it still reads as the same scene.
  rctx.save();
  rctx.globalCompositeOperation = "screen";
  rctx.globalAlpha = 0.25;
  rctx.drawImage(edges, 0, 0);
  rctx.restore();

  return { grey, edges, grain };
}

/** Sweep a scanner line across, revealing `to` over `from`. */
export function wipe(ctx: CanvasRenderingContext2D, from: CanvasImageSource, to: CanvasImageSource, p: number, w: number, h: number) {
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const x = w * e;
  ctx.drawImage(from, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, x, h);
  ctx.clip();
  ctx.drawImage(to, 0, 0);
  ctx.restore();
  if (p > 0 && p < 1) {
    const g = ctx.createLinearGradient(x - 60, 0, x, 0);
    g.addColorStop(0, "rgba(203,222,121,0)");
    g.addColorStop(1, "rgba(203,222,121,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, 0, 60, h);
    ctx.save();
    ctx.strokeStyle = "#cbde79";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#cbde79";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.restore();
  }
}

/** Crossfade from one picture to another. */
export function fade(ctx: CanvasRenderingContext2D, from: CanvasImageSource, to: CanvasImageSource, p: number) {
  ctx.globalAlpha = 1;
  ctx.drawImage(from, 0, 0);
  ctx.globalAlpha = p;
  ctx.drawImage(to, 0, 0);
  ctx.globalAlpha = 1;
}
