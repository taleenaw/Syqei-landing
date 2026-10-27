# Syqei website

The marketing site for syqei.com. Plain HTML pages, built with Vite and deployed by Netlify.

## Run it locally

Use Node 22.

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Changes show as you save.

## Build

```bash
npm run build     # outputs to dist/
npm run preview   # serves dist/ to check the build
npm run check     # type checks the mission preview code
```

Netlify reads `netlify.toml`. It runs `npm run build` and publishes `dist/`. You don't need to set anything in the Netlify dashboard.

## Where things live

| Path | What it is |
| --- | --- |
| `*.html` at the root | One file per page. Edit the text directly |
| `stories/` | Published stories |
| `public/style.css` | All styles |
| `public/script.js` | Forms, analytics events, the readiness checklist |
| `src/preview.ts` | The 30 second Mission 001 preview |
| `src/vision/` | Scene, detector and visuals copied from the syqei-studio app. Copy them again if the studio versions change |
| `public/images/` | Images |
| `public/_redirects`, `public/_headers` | Netlify redirects and security headers |
| `public/sitemap.xml`, `public/robots.txt` | For search engines. Add new pages to the sitemap |

To add a page, create the HTML file at the root and add its name to `pages` in `vite.config.js`.

## Forms

Netlify Forms picks up the `enquiry`, `parent-waitlist` and `newsletter` forms on deploy. Submissions show in Netlify under Forms.

## Analytics events (GA4)

| Event | When |
| --- | --- |
| `cta_click` | A main button is clicked. `cta` says which one and where |
| `mission_preview_start`, `mission_preview_complete` | Someone plays the 30 second preview |
| `pricing_view`, `pilot_results_view` | Pricing or pilot results come into view, or the results link is clicked |
| `teacher_guide_view`, `device_check_click` | Links to the teacher guide or device check |
| `faq_open` | An FAQ is opened. `topic` says which |
| `form_start` | Someone starts filling in a form |
| `generate_lead` | A form is sent. `lead_type` is `pilot_enquiry`, `parent_waitlist` or `newsletter` |
| `email_click` | An email link is clicked |

Never send names, emails or form text to analytics.

## Publishing changes

Work on a branch, open a pull request, check the Netlify Deploy Preview link, then merge to `main`. Merging to `main` publishes the site.
