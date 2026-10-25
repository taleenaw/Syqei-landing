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
        if (typeof window.gtag === "function") {
          var role = form.querySelector("[name=role]");
          window.gtag("event", form.getAttribute("name") === "enquiry" ? "generate_lead" : "sign_up", {
            form_name: form.getAttribute("name"),
            role: role ? role.value : undefined,
          });
        }
      })
      .catch(function () {
        if (button) button.disabled = false;
        if (error) error.hidden = false;
      });
  });
});
