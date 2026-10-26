// Syqei site script. Plain JS, loaded on every page.

// ===== Analytics =====
// GA4 events. Never send names, emails or anything typed into a form.
function track(name, params) {
  if (typeof window.gtag !== "function") return;
  params = params || {};
  params.page_path = window.location.pathname;
  window.gtag("event", name, params);
}

// Main buttons. data-cta says which button and where it sits.
document.querySelectorAll("[data-cta]").forEach(function (el) {
  el.addEventListener("click", function () {
    track("cta_click", { cta: el.dataset.cta });
  });
});
document.querySelectorAll('a[href^="mailto:"]').forEach(function (el) {
  el.addEventListener("click", function () {
    track("email_click");
  });
});
document.querySelectorAll("[data-device-check]").forEach(function (el) {
  el.addEventListener("click", function () {
    track("device_check_click");
  });
});
document.querySelectorAll("[data-teacher-guide]").forEach(function (el) {
  el.addEventListener("click", function () {
    track("teacher_guide_view");
  });
});
document.querySelectorAll("[data-results-link]").forEach(function (el) {
  el.addEventListener("click", function () {
    track("pilot_results_view", { via: "link" });
  });
});
document.querySelectorAll("details[data-faq]").forEach(function (el) {
  el.addEventListener("toggle", function () {
    if (el.open) track("faq_open", { topic: el.dataset.faq });
  });
});

// Sections worth knowing someone reached. Fires once per page view.
if ("IntersectionObserver" in window) {
  var seen = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var name = entry.target.dataset.view;
        track(name === "pricing" ? "pricing_view" : "pilot_results_view", { via: "scroll" });
        seen.unobserve(entry.target);
      });
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll("[data-view]").forEach(function (el) {
    seen.observe(el);
  });
}

// ===== Try 30 seconds button =====
// Scrolls to the preview and puts focus on its Start button.
document.querySelectorAll("[data-try]").forEach(function (el) {
  el.addEventListener("click", function (e) {
    var start = document.querySelector("[data-preview] [data-start]");
    if (!start) return;
    e.preventDefault();
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("try").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (!start.closest("[hidden]")) start.focus({ preventScroll: true });
  });
});

// ===== Could you run this tomorrow =====
document.querySelectorAll("[data-ready]").forEach(function (form) {
  var boxes = form.querySelectorAll("input[type=checkbox]");
  var out = form.querySelector("[data-ready-result]");
  form.addEventListener("change", function () {
    var n = 0;
    boxes.forEach(function (b) {
      if (b.checked) n++;
    });
    out.textContent =
      n === boxes.length
        ? "You're ready to run a mission tomorrow."
        : n + " of " + boxes.length + " ticked.";
  });
});

// ===== Netlify forms =====
// Posts in the background so people see a success message without leaving the page.
document.querySelectorAll("form[data-netlify]").forEach(function (form) {
  var page = form.querySelector("[name=source_page]");
  if (page) page.value = window.location.pathname;
  var started = false;
  form.addEventListener("focusin", function () {
    if (started) return;
    started = true;
    track("form_start", { form_name: form.getAttribute("name") });
  });

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
        track("generate_lead", {
          lead_type: form.getAttribute("name") === "enquiry" ? "pilot_enquiry" : "newsletter",
          source_page: window.location.pathname,
          role: role ? role.value : undefined,
        });
      })
      .catch(function () {
        if (button) button.disabled = false;
        if (error) error.hidden = false;
      });
  });
});

// ===== Computer vision marks =====
// Detection boxes lock on and their confidence counts up when they scroll into view.
// Scan lines sweep once. Without JS, or with reduced motion, everything just shows.
(function () {
  var marks = document.querySelectorAll(".cv, .scan-edge, .cv-wing");
  if (!marks.length || !("IntersectionObserver" in window)) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("cv-on");

  function countUp(el) {
    var label = el.getAttribute("data-label") || "";
    var m = label.match(/^(.*?)(\d+)%$/);
    if (!m || reduced) return;
    var prefix = m[1];
    var target = Number(m[2]);
    var start = performance.now();
    var dur = 700;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.setAttribute("data-label", prefix + Math.round(target * eased) + "%");
      if (p < 1) requestAnimationFrame(frame);
    }
    el.setAttribute("data-label", prefix + "0%");
    requestAnimationFrame(frame);
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add("is-found");
        if (el.classList.contains("cv")) setTimeout(function () { countUp(el); }, reduced ? 0 : 250);
        io.unobserve(el);
      });
    },
    { threshold: 0.35, rootMargin: "0px 0px -8% 0px" },
  );
  marks.forEach(function (el) {
    io.observe(el);
  });
})();
