import { resolve } from "node:path";
import { defineConfig } from "vite";

// Every page is a plain HTML file at the repo root. Vite builds them all into dist/.
// Files in public/ (styles, images, redirects) are copied as they are.
const pages = [
  "index",
  "partner",
  "projects",
  "about",
  "stories",
  "stories/first-pilot",
  "privacy",
  "accessibility",
  "research",
  "curriculum",
  "trust",
  "how-it-works",
  "press",
  "careers",
  "teachers",
  "parents",
  "roadmap",
  "lab-notes",
  "think",
  "404",
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])),
    },
  },
});
