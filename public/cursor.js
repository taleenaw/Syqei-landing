// Butterfly cursor.
// A small Syqei butterfly follows the pointer with a gentle lag and tilts
// towards the way it's moving. The normal cursor stays visible underneath,
// so it never gets in the way of clicking. Desktop only. It switches off for
// touch screens, for people who ask for less motion, and when the site's
// motion toggle is off.
(function () {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  var reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var style = document.createElement("style");
  style.textContent =
    ".cursor-bfly{position:fixed;top:0;left:0;z-index:2000;pointer-events:none;opacity:0;" +
    "transition:opacity .4s ease;will-change:transform;margin:-10px 0 0 -10px}" +
    ".cursor-bfly span{display:block;width:20px;height:34px;" +
    "background:url(/images/brand/symbol.svg) center/contain no-repeat;" +
    "filter:drop-shadow(0 0 .6px #14032a) drop-shadow(0 0 .6px #14032a) drop-shadow(0 0 .6px #14032a) drop-shadow(0 3px 6px rgba(20,3,42,.3));" +
    "transform-origin:30% 55%;animation:cursor-bfly-flap .55s ease-in-out infinite alternate}" +
    "@keyframes cursor-bfly-flap{from{transform:scaleX(1)}to{transform:scaleX(.7)}}" +
    "@media (hover:none),(pointer:coarse),(prefers-reduced-motion:reduce){.cursor-bfly{display:none!important}}" +
    "html[data-motion=off] .cursor-bfly{display:none!important}";
  document.head.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "cursor-bfly";
  wrap.setAttribute("aria-hidden", "true");
  wrap.appendChild(document.createElement("span"));
  document.body.appendChild(wrap);

  var tx = window.innerWidth / 2;
  var ty = window.innerHeight / 2;
  var px = tx;
  var py = ty;
  var lastX = px;
  var angle = 0;
  var seen = false;
  var running = false;

  function off() {
    return reducedQuery.matches || document.documentElement.dataset.motion === "off";
  }

  window.addEventListener(
    "mousemove",
    function (e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!seen) {
        seen = true;
        px = tx;
        py = ty;
        wrap.style.opacity = "1";
      }
      start();
    },
    { passive: true }
  );
  document.addEventListener("mouseleave", function () { wrap.style.opacity = "0"; });
  document.addEventListener("mouseenter", function () { if (seen) wrap.style.opacity = "1"; });

  var LAG = 0.14;
  function tick() {
    if (off()) { running = false; return; }
    px += (tx - px) * LAG;
    py += (ty - py) * LAG;
    var dx = px - lastX;
    lastX = px;
    var target = Math.max(-22, Math.min(22, dx * 3));
    angle += (target - angle) * 0.1;
    // Sits down and to the right of the pointer, so it trails beside the tip.
    wrap.style.transform = "translate(" + (px + 14) + "px," + (py + 14) + "px) rotate(" + angle + "deg)";
    if (Math.abs(tx - px) < 0.1 && Math.abs(ty - py) < 0.1 && Math.abs(angle) < 0.1) {
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  }
  function start() {
    if (running || off()) return;
    running = true;
    requestAnimationFrame(tick);
  }
})();
