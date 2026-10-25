/**
 * A 30 second slice of Mission 001. The visitor hunts for one camouflaged moth,
 * then the same computer vision detector used in the mission runs on the same
 * image. The scene, detector and visuals are copied from the Syqei Studio app.
 */
import { SCENE_H, SCENE_W, drawScene, hits, type Backdrop, type Target } from "./vision/camoScene";
import { detect } from "./vision/detect";
import { buildViews, drawBox, fade, paintScan, wipe } from "./vision/visuals";

const LIME = "#cbde79";
const MISS = "#f2a7a0";
const LIMIT = 20;
const BACKDROPS: Backdrop[] = ["bark", "gravel", "lichen", "litter"];

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(name: string, params: Record<string, unknown> = {}) {
  window.gtag?.("event", name, { ...params, page_path: window.location.pathname });
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = MISS;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 12);
  ctx.lineTo(x + 12, y + 12);
  ctx.moveTo(x + 12, y - 12);
  ctx.lineTo(x - 12, y + 12);
  ctx.stroke();
  ctx.restore();
}

function mount(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const overlay = root.querySelector<HTMLElement>("[data-overlay]")!;
  const chip = root.querySelector<HTMLElement>("[data-chip]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const startBtn = root.querySelector<HTMLButtonElement>("[data-start]")!;
  const showBtn = root.querySelector<HTMLButtonElement>("[data-show]")!;
  const raceBtn = root.querySelector<HTMLButtonElement>("[data-race]")!;
  const againBtn = root.querySelector<HTMLButtonElement>("[data-again]")!;
  const after = root.querySelector<HTMLElement>("[data-after]")!;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const location = root.dataset.preview || "page";

  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const clean = document.createElement("canvas");
  clean.width = SCENE_W;
  clean.height = SCENE_H;

  let target: Target | null = null;
  let playing = false;
  let start = 0;
  let raf = 0;
  let youMs: number | null = null;
  let misses = 0;
  let round = 0;

  const show = (el: HTMLElement, on: boolean) => (el.hidden = !on);
  const setChip = (text: string) => {
    chip.textContent = text;
    show(chip, text !== "");
  };

  function begin() {
    round++;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const backdrop = BACKDROPS[(round - 1) % BACKDROPS.length];
    target = drawScene(clean.getContext("2d")!, { backdrop, difficulty: 0.4, seed });
    ctx.drawImage(clean, 0, 0);
    show(overlay, false);
    const poster = root.querySelector<HTMLElement>(".preview-poster");
    if (poster) poster.hidden = true;
    show(after, false);
    show(raceBtn, false);
    show(againBtn, false);
    show(showBtn, true);
    canvas.classList.add("is-live");
    youMs = null;
    misses = 0;
    playing = true;
    status.textContent = "Click the moth when you spot it.";
    start = performance.now();
    canvas.focus({ preventScroll: true });
    const tick = () => {
      if (!playing) return;
      const left = LIMIT - (performance.now() - start) / 1000;
      if (left <= 0) {
        end(false);
        return;
      }
      setChip(`${left.toFixed(1)} s`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    track("mission_preview_start", { location, round });
  }

  function end(found: boolean) {
    playing = false;
    cancelAnimationFrame(raf);
    canvas.classList.remove("is-live");
    show(showBtn, false);
    const t = target!;
    ring(ctx, t.x, t.y, t.r * 1.15, found ? LIME : MISS);
    if (found) {
      youMs = performance.now() - start;
      setChip("Found it");
      status.textContent = `You found it in ${(youMs / 1000).toFixed(1)} seconds${misses ? ` with ${misses} miss${misses === 1 ? "" : "es"}` : ""}. Now race the computer on the same image.`;
    } else {
      setChip("Not found");
      status.textContent = "It was hiding in the circle. Camouflage works. Now see if it fools the computer too.";
    }
    show(raceBtn, true);
    raceBtn.focus();
  }

  canvas.addEventListener("click", (e) => {
    if (!playing || !target) return;
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * SCENE_W;
    const y = ((e.clientY - box.top) / box.height) * SCENE_H;
    if (hits(target, x, y)) end(true);
    else {
      misses++;
      cross(ctx, x, y);
      status.textContent = `Not there. ${misses} miss${misses === 1 ? "" : "es"} so far.`;
    }
  });

  const wait = (ms: number) => (reduced ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  const animate = (ms: number, draw: (p: number) => void) =>
    new Promise<void>((resolve) => {
      if (reduced) {
        draw(1);
        resolve();
        return;
      }
      const t0 = performance.now();
      const frame = () => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        draw(p);
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  async function race() {
    show(raceBtn, false);
    const t = target!;
    const W = SCENE_W;
    const H = SCENE_H;
    status.textContent = "The computer is reading the same image. This replay is slowed down so you can watch.";
    const det = detect(clean, t.r);
    const found = Math.hypot(det.x - t.x, det.y - t.y) <= t.r * 1.1;
    const v = buildViews(clean);
    const dim = document.createElement("canvas");
    dim.width = W;
    dim.height = H;
    const d = dim.getContext("2d")!;
    d.drawImage(clean, 0, 0);
    d.fillStyle = "rgba(20,3,42,0.45)";
    d.fillRect(0, 0, W, H);

    setChip("Greyscale");
    await animate(600, (p) => wipe(ctx, clean, v.grey, p, W, H));
    await wait(250);
    setChip("Edge detection");
    await animate(650, (p) => wipe(ctx, v.grey, v.edges, p, W, H));
    await wait(550);
    setChip("Grain direction");
    await animate(650, (p) => wipe(ctx, v.edges, v.grain, p, W, H));
    await wait(550);
    setChip("Scanning every patch");
    await animate(400, (p) => fade(ctx, v.grain, dim, p));
    await animate(850, (p) => {
      ctx.drawImage(dim, 0, 0);
      paintScan(ctx, det, W, H, p);
    });
    setChip(found ? "Found it" : "Fooled");
    const top = det.candidates[0];
    await animate(450, (p) => {
      fade(ctx, dim, clean, p);
      const e = 1 - Math.pow(1 - p, 3);
      if (!found && p > 0.5) drawBox(ctx, t.x, t.y, t.r * 1.05, "actual moth", "rgba(216,209,231,0.95)", { dashed: true, width: 2 });
      drawBox(ctx, top.x, top.y, t.r * (1.05 + 1.6 * (1 - e)), `moth ${Math.round(top.confidence * 100)}%`, found ? LIME : MISS, { width: 4 });
    });

    const compSec = det.ms / 1000;
    const you = youMs === null ? "You didn't find it in 20 seconds." : `You took ${(youMs / 1000).toFixed(1)} seconds.`;
    const comp = found
      ? `The computer found it in ${compSec.toFixed(2)} seconds.`
      : `The computer took ${compSec.toFixed(2)} seconds and picked the wrong spot. Camouflage fooled it this time.`;
    const faster = youMs !== null && found ? ` That's about ${Math.max(2, Math.round(youMs / det.ms))} times faster than you.` : "";
    status.textContent = `${you} ${comp}${faster}`;
    show(after, true);
    show(againBtn, true);
    track("mission_preview_complete", { location, you_found: youMs !== null, computer_found: found });
  }

  startBtn.addEventListener("click", begin);
  againBtn.addEventListener("click", begin);
  showBtn.addEventListener("click", () => playing && end(false));
  raceBtn.addEventListener("click", race);
  root.classList.add("is-ready");
}

document.querySelectorAll<HTMLElement>("[data-preview]").forEach(mount);
