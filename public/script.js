// ===== Butterfly renderer -- uses the real PNG artwork, not a redrawn approximation =====
// Each butterfly is the same image twice, stacked, each clipped to show only its
// left or right half. Scaling each half toward the center fakes a wing flap while
// keeping full fidelity to the original icon (no shape loss).
function butterflyMarkup(src, size = 26) {
  const h = Math.round(size * 0.9);
  return `
    <div class="butterfly-real" style="width:${size}px; height:${h}px;">
      <img class="bfly-half bfly-left" src="${src}" alt="">
      <img class="bfly-half bfly-right" src="${src}" alt="">
    </div>`;
}

const GARDEN_SIZES = [30, 62, 22, 46, 74, 36]; // small/big mix, matched to each span below

document.querySelectorAll('.g-butterfly').forEach((el, i) => {
  const src = el.dataset.src || '/images/butterfly-3a-lavender-violet.png';
  const size = GARDEN_SIZES[i] || 26;
  el.innerHTML = butterflyMarkup(src, size);
  el.style.setProperty('--flap-delay', `${(i * -0.35).toFixed(2)}s`);
  el.style.setProperty('--flap-dur', `${(2.1 + (i % 3) * 0.3).toFixed(2)}s`);
});

// ===== Nav over film =====
// The nav sits transparent over the cinematic hero, then turns solid once the
// hero has (mostly) scrolled past. We flip the class a little before the film's
// bottom edge so the switch feels intentional, not abrupt.
const nav = document.getElementById('site-nav');
const filmHero = document.querySelector('.film-hero');

if (nav && filmHero) {
  const onScroll = () => {
    const switchPoint = filmHero.offsetHeight - nav.offsetHeight - 40;
    if (window.scrollY > switchPoint) {
      nav.classList.remove('nav--over-hero');
    } else {
      nav.classList.add('nav--over-hero');
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

// ===== Newsletter form =====
// Netlify Forms submits via a normal POST + page redirect by default.
// This intercepts it so the person sees an inline success message instead
// of navigating away, without needing a separate success.html page.
const form = document.getElementById('waitlist-form');
const success = document.getElementById('form-success');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
    })
      .then(() => {
        form.hidden = true;
        success.hidden = false;
      })
      .catch(() => {
        form.submit();
      });
  });
}

// ===== Gentle scroll-reveal for sections =====
// Progressive enhancement: sections are fully visible by default (in CSS).
// Only if JS runs AND the browser supports IntersectionObserver do we hide
// them first and fade them in -- so content is never permanently invisible
// if a script fails, and reduced-motion users skip the effect entirely.
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealTargets = document.querySelectorAll('.discover-section, .founder-split, .science-film-content, .waitlist');

if (!prefersReduced && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealTargets.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
    // Safety net: if the observer hasn't revealed it within 2.5s
    // (e.g. it loaded already in-view but the callback was missed), show it.
    setTimeout(() => {
      if (el.style.opacity === '0') {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    }, 2500);
  });
}

// ===== Trailing butterfly cursor =====
// A butterfly that follows the real pointer with a gentle lag and banks toward
// its direction of travel. The system cursor stays visible underneath -- this
// is ambient decoration, not a replacement, so you can always see what you're
// clicking. Runs only on devices with a fine pointer (skips touch), respects
// reduced-motion, and never intercepts clicks (pointer-events: none).
(function () {
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reduced) return;

  const wrap = document.createElement('div');
  wrap.className = 'cursor-bfly';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <div class="butterfly-real" style="width:40px; height:35px; --flap-dur:0.5s;">
      <img class="bfly-half bfly-left" src="/images/butterfly-3d-lavender-sage.png" alt="">
      <img class="bfly-half bfly-right" src="/images/butterfly-3d-lavender-sage.png" alt="">
    </div>`;
  document.body.appendChild(wrap);

  // target = real mouse; pos = eased follower position
  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let px = tx, py = ty;
  let lastX = px, angle = 0;
  let visible = false;

  window.addEventListener('mousemove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (!visible) { visible = true; wrap.style.opacity = '1'; }
  }, { passive: true });

  // fade out when the pointer leaves the window
  document.addEventListener('mouseleave', () => { wrap.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { if (visible) wrap.style.opacity = '1'; });

  const LAG = 0.14; // lower = more delay / floatier, higher = snappier
  function tick() {
    px += (tx - px) * LAG;
    py += (ty - py) * LAG;

    // bank toward horizontal direction of travel, gently
    const dx = px - lastX;
    lastX = px;
    const targetAngle = Math.max(-22, Math.min(22, dx * 3));
    angle += (targetAngle - angle) * 0.1;

    // offset down-right so the larger butterfly trails beside the tip, not under it
    wrap.style.transform =
      `translate(${px + 20}px, ${py + 20}px) rotate(${angle}deg)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
