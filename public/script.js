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
  // stagger each garden butterfly's flap so they don't move in sync
  el.style.setProperty('--flap-delay', `${(i * -0.35).toFixed(2)}s`);
  el.style.setProperty('--flap-dur', `${(2.1 + (i % 3) * 0.3).toFixed(2)}s`);
});

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
        // Fall back to a normal form submit if the fetch fails for any reason
        form.submit();
      });
  });
}

// Gentle scroll-reveal for sections
const revealTargets = document.querySelectorAll('.why, .live-feed, .how, .garden-preview, .passport, .values, .trust, .waitlist');
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
  { threshold: 0.15 }
);

revealTargets.forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(16px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});
