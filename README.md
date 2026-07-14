# Syqei Website

A single-page landing site: hero, problem/differentiation, how it works, values, and a waitlist form.
No build step — plain HTML/CSS/JS. Deploys straight to Netlify.

## 1. Get it running locally (in Kitty)

Unzip the folder, then in Kitty:

```bash
cd path/to/syqei-website
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser. Edit `index.html` / `style.css` / `script.js`
in your editor of choice, save, refresh the browser to see changes. Ctrl+C in Kitty to stop the server.

## 2. Put it on GitHub (recommended, makes Netlify auto-deploy on every save)

```bash
cd path/to/syqei-website
git init
git add .
git commit -m "Initial Syqei landing page"
```

Then create a new empty repo on github.com (no README/gitignore), and:

```bash
git remote add origin https://github.com/YOUR_USERNAME/syqei-website.git
git branch -M main
git push -u origin main
```

## 3. Deploy to Netlify

1. Go to app.netlify.com → sign up/log in (free tier is fine)
2. "Add new site" → "Import an existing project" → connect GitHub → pick `syqei-website`
3. Leave build settings blank (no build command, publish directory = `/`) since this is plain HTML
4. Click Deploy — you'll get a live `random-name-123.netlify.app` URL within a minute

**No separate email/waitlist backend needed** — the form on the page already has
`data-netlify="true"`, which Netlify auto-detects on deploy. Submissions show up under
Netlify dashboard → your site → **Forms**. You can also set up an email notification there
(Site settings → Forms → Form notifications) so you get an email every time someone joins.

## 4. Connect your Porkbun domain (syqei.com)

In Netlify: Site settings → Domain management → Add a domain → enter `syqei.com`.

Netlify will give you either:
- **A records** to add (simplest — stays on Porkbun's own DNS), or
- **Netlify's own nameservers** to switch to (only do this if you want Netlify managing all DNS)

Recommended: stick with A records so you don't disturb your existing Porkbun DNS setup
(you've already got 11 DNS records configured, including the `/survey` forwarding).

In Porkbun: Domain → syqei.com → DNS Records → add the A record(s) Netlify gives you,
pointing `@` (root domain) at Netlify's IP. If you want `www.syqei.com` too, add the CNAME
Netlify provides for that as well.

DNS changes can take anywhere from a few minutes to a few hours to propagate.

## 5. Update content later

Everything's in plain text inside `index.html` — headline, copy, the "happening near you
right now" example, and the three how-it-works steps. No build tool needed, just edit,
save, and push to GitHub — Netlify redeploys automatically within about a minute.
