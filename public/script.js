// Syqei site script. Plain JS, no build step.

// ===== Hero scan video =====
// Respect reduced motion. The poster frame shows instead, with a button to play.
(function () {
  var video = document.querySelector("[data-scan]");
  var toggle = document.querySelector("[data-scan-toggle]");
  if (!video || !toggle) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function label() {
    toggle.textContent = video.paused ? "Play" : "Pause";
    toggle.setAttribute("aria-label", video.paused ? "Play the scan video" : "Pause the scan video");
  }
  if (reduced) video.pause();
  else video.play().catch(function () {});
  toggle.addEventListener("click", function () {
    if (video.paused) video.play().catch(function () {});
    else video.pause();
  });
  video.addEventListener("play", label);
  video.addEventListener("pause", label);
  label();
})();

// ===== Conversion tracking =====
// GA4 events. cta_click for main buttons, form_start when someone begins a form,
// and generate_lead or sign_up when it sends. Each one records the page it came from.
function track(name, params) {
  if (typeof window.gtag !== "function") return;
  params = params || {};
  params.page_path = window.location.pathname;
  window.gtag("event", name, params);
}

document.querySelectorAll("[data-cta]").forEach(function (el) {
  el.addEventListener("click", function () {
    track("cta_click", { cta: el.dataset.cta });
  });
});

document.querySelectorAll("form[data-netlify]").forEach(function (form) {
  var page = form.querySelector("[name=source_page]");
  if (page) page.value = window.location.pathname;
  var started = false;
  form.addEventListener("focusin", function () {
    if (started) return;
    started = true;
    track("form_start", { form_name: form.getAttribute("name") });
  });
});

// ===== Netlify forms =====
// Posts in the background so people see a success message without leaving the page.
// Falls back to a normal submit if the request fails.
document.querySelectorAll("form[data-netlify]").forEach(function (form) {
  var success = document.getElementById(form.dataset.success);
  var error = form.querySelector(".form-error");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (error) error.hidden = true;
    var button = form.querySelector("[type=submit]");
    if (button) button.disabled = true;
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)).toString(),
    })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        var role = form.querySelector("[name=role]");
        track(form.getAttribute("name") === "enquiry" ? "generate_lead" : "sign_up", {
          form_name: form.getAttribute("name"),
          role: role ? role.value : undefined,
        });
      })
      .catch(function () {
        if (button) button.disabled = false;
        if (error) error.hidden = false;
      });
  });
});
