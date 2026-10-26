/**
 * Edge-detection lens. Inside the circle you see what a computer vision
 * model sees: edges, grain direction or greyscale. Works with a mouse,
 * touch and the arrow keys.
 */
import { motionOff, track } from "./motion";

const SRC: Record<string, string> = {
  edges: "/images/mission/lens-edges.jpg",
  grain: "/images/mission/lens-grain.jpg",
  grey: "/images/mission/lens-grey.jpg",
};

function mount(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>(".lens-stage")!;
  const view = root.querySelector<HTMLImageElement>("[data-lens-img]")!;
  const all = root.querySelector<HTMLButtonElement>("[data-lens-all]")!;
  const find = root.querySelector<HTMLButtonElement>("[data-lens-find]")!;
  const modes = root.querySelectorAll<HTMLButtonElement>("[data-mode]");
  let x = 50;
  let y = 55;
  let used = false;

  // Preload the other views so switching is instant.
  Object.values(SRC).forEach((s) => (new Image().src = s));

  const place = () => {
    stage.style.setProperty("--x", `${x}%`);
    stage.style.setProperty("--y", `${y}%`);
  };
  const firstUse = () => {
    if (used) return;
    used = true;
    track("lens_use");
  };

  const fromPointer = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    place();
    firstUse();
  };
  stage.addEventListener("pointermove", fromPointer);
  stage.addEventListener("pointerdown", fromPointer);

  stage.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft") x -= step;
    else if (e.key === "ArrowRight") x += step;
    else if (e.key === "ArrowUp") y -= step;
    else if (e.key === "ArrowDown") y += step;
    else return;
    e.preventDefault();
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    place();
    firstUse();
  });

  modes.forEach((b) =>
    b.addEventListener("click", () => {
      modes.forEach((m) => {
        m.classList.toggle("is-on", m === b);
        m.setAttribute("aria-pressed", String(m === b));
      });
      view.src = SRC[b.dataset.mode!];
      track("lens_mode", { mode: b.dataset.mode });
    }),
  );

  all.addEventListener("click", () => {
    const on = !root.classList.contains("is-all");
    root.classList.toggle("is-all", on);
    all.setAttribute("aria-pressed", String(on));
    all.textContent = on ? "Back to the lens" : "Show everywhere";
  });

  find.addEventListener("click", () => {
    root.classList.add("is-found");
    x = 26.8;
    y = 24.4;
    place();
    find.textContent = "Found it";
    find.disabled = true;
    track("lens_find");
  });

  place();
  root.classList.add("is-ready");
  if (motionOff()) root.classList.add("is-still");
}

document.querySelectorAll<HTMLElement>("[data-lens]").forEach(mount);
