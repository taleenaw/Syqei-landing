import { motionOff, track } from "./motion";

/**
 * Flat-to-3D wing. As the section scrolls past, the painted wing turns side on
 * and shows it was flat all along. With motion off, the static three-frame
 * version in the markup stays instead.
 */
const section = document.querySelector<HTMLElement>("[data-flatwing]");

if (section && !motionOff()) {
  const steps = Array.from(section.querySelectorAll<HTMLLIElement>("[data-step]"));
  const tag = section.querySelector<HTMLElement>("[data-flatwing-tag]");
  let frame = 0;
  let last = -1;
  let tracked = false;

  section.classList.add("is-live");

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const ease = (t: number) => t * t * (3 - 2 * t);

  const update = () => {
    frame = 0;
    const r = section.getBoundingClientRect();
    const travel = r.height - window.innerHeight;
    const p = travel > 0 ? clamp(-r.top / travel, 0, 1) : 0;
    const turn = ease(clamp((p - 0.28) / 0.44, 0, 1));
    section.style.setProperty("--turn", turn.toFixed(4));
    const step = p < 0.3 ? 0 : p < 0.68 ? 1 : 2;
    if (step !== last) {
      last = step;
      steps.forEach((li, i) => li.classList.toggle("is-on", i === step));
      if (tag) tag.textContent = step === 2 ? "flat 99%" : step === 1 ? "leaf 64%" : "leaf 91%";
      section.dataset.step = String(step);
      if (step === 2 && !tracked) {
        tracked = true;
        track("flatwing_seen");
      }
    }
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  // If the visitor turns motion off from the footer switch, fall back to the static frames.
  new MutationObserver(() => {
    if (motionOff()) {
      section.classList.remove("is-live");
      window.removeEventListener("scroll", onScroll);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
}
