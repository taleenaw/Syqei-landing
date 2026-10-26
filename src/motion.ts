/** Shared helpers for the site's effects. */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** True when the visitor's OS asks for less motion, or they switched motion off on the site. */
export function motionOff(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "off"
  );
}

export function track(name: string, params: Record<string, unknown> = {}) {
  window.gtag?.("event", name, { ...params, page_path: window.location.pathname });
}
