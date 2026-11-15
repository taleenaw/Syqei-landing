// Syqei site script. Plain JS, loaded on every page.

// True when the OS asks for less motion, or the visitor switched motion off on the site.
function motionOff() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "off"
  );
}

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
    var reduced = motionOff();
    document.getElementById("try").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (!start.closest("[hidden]")) start.focus({ preventScroll: true });
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
          lead_type: { enquiry: "pilot_enquiry", "propose-mission": "mission_proposal", "parent-waitlist": "parent_waitlist" }[form.getAttribute("name")] || "newsletter",
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
  var marks = document.querySelectorAll(".cv, .scan-edge");
  if (!marks.length || !("IntersectionObserver" in window)) return;
  var reduced = motionOff();
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
    if (el.hasAttribute("data-camo") && !reduced) return;
    io.observe(el);
  });
  window.__cvCountUp = countUp;
})();


// ===== Motion toggle =====
// A switch in the footer, for people who don't know their computer has a reduce motion setting.
document.querySelectorAll("[data-motion-toggle]").forEach(function (btn) {
  function label() {
    var off = document.documentElement.dataset.motion === "off";
    btn.textContent = off ? "Motion off" : "Motion on";
    btn.setAttribute("aria-pressed", String(!off));
  }
  btn.addEventListener("click", function () {
    var off = document.documentElement.dataset.motion !== "off";
    if (off) document.documentElement.dataset.motion = "off";
    else delete document.documentElement.dataset.motion;
    try {
      localStorage.setItem("syqei:motion", off ? "off" : "on");
    } catch (e) {}
    label();
    track("motion_toggle", { motion: off ? "off" : "on" });
  });
  label();
});

// Skip the scan-sweep page transition when motion is off.
window.addEventListener("pagereveal", function (e) {
  if (e.viewTransition && motionOff()) e.viewTransition.skipTransition();
});
window.addEventListener("pageswap", function (e) {
  if (e.viewTransition && motionOff()) e.viewTransition.skipTransition();
});

// ===== Decode labels =====
// Short labels like "48 of 51" or "SQ-001.1" scramble briefly then settle, like a detector reading them.
// The real text stays in the page for screen readers the whole time.
(function () {
  var els = document.querySelectorAll("[data-decode]");
  if (!els.length || motionOff() || !("IntersectionObserver" in window)) return;
  var glyphs = "0123456789ABCDEFHKMNPRSTVXZ#%";
  function decode(el) {
    var finalText = el.getAttribute("data-final");
    var shown = el.querySelector(".decode-shown");
    var start = performance.now();
    var dur = 650;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var locked = Math.floor(p * finalText.length);
      var out = "";
      for (var i = 0; i < finalText.length; i++) {
        var ch = finalText[i];
        out += i < locked || ch === " " || ch === "." || ch === "-" ? ch : glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      shown.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else shown.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        decode(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.6 },
  );
  els.forEach(function (el) {
    var text = el.textContent;
    el.setAttribute("data-final", text);
    el.innerHTML = '<span class="visually-hidden">' + text + '</span><span class="decode-shown" aria-hidden="true">' + text + "</span>";
    io.observe(el);
  });
})();

// ===== Camouflaged headline =====
// The hero headline starts hidden in wing texture. A scan passes once, the camouflage
// drains away and the detection box locks on. Once per visit. The text is always real text.
(function () {
  var h = document.querySelector("[data-camo]");
  if (!h || motionOff()) return;
  var seen = false;
  try {
    seen = sessionStorage.getItem("syqei:camo") === "1";
    sessionStorage.setItem("syqei:camo", "1");
  } catch (e) {}
  function lockOn() {
    h.classList.add("is-found");
    if (window.__cvCountUp) setTimeout(function () { window.__cvCountUp(h); }, 250);
  }
  if (seen) {
    lockOn();
    return;
  }
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="camo-filter" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="2" seed="7" result="n"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>' +
    "</filter>";
  document.body.appendChild(svg);
  var disp = svg.querySelector("feDisplacementMap");
  var scan = document.createElement("span");
  scan.className = "camo-scan";
  scan.setAttribute("aria-hidden", "true");
  h.appendChild(scan);
  h.classList.add("is-camo");
  var start = performance.now() + 250;
  var dur = 1500;
  function frame(now) {
    var p = Math.max(0, Math.min(1, (now - start) / dur));
    var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    disp.setAttribute("scale", String(34 * (1 - e)));
    h.style.setProperty("--camo", String(1 - e));
    h.style.setProperty("--scan", (p * 100).toFixed(1) + "%");
    if (p < 1) requestAnimationFrame(frame);
    else {
      h.classList.remove("is-camo");
      scan.remove();
      svg.remove();
      lockOn();
    }
  }
  requestAnimationFrame(frame);
})();

// ===== Margin notes that write themselves in, and headings that come into focus =====
// Both only run with motion on. With motion off the notes and headings are simply there.
(function () {
  if (motionOff() || !("IntersectionObserver" in window)) return;
  var root = document.documentElement;
  var notes = document.querySelectorAll(".note");
  var heads = document.querySelectorAll(".band h2, .page-head ~ section h2");
  if (notes.length) root.classList.add("notes-ready");
  if (heads.length) root.classList.add("sharp-ready");

  var watch = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target._notes) {
          entry.target._notes.forEach(function (n, i) {
            setTimeout(function () { n.classList.add("is-drawn"); }, 250 + i * 300);
          });
        } else {
          entry.target.classList.add("is-sharp");
        }
        watch.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -18% 0px", threshold: 0.2 }
  );
  // Watch what each note is written beside, not the note itself (a note sits half outside it).
  notes.forEach(function (n) {
    var host = n.parentElement;
    (host._notes = host._notes || []).push(n);
    watch.observe(host);
  });
  heads.forEach(function (h) {
    // Headings already on screen when the page opens stay as they are.
    if (h.getBoundingClientRect().top < window.innerHeight * 0.85) h.classList.add("is-sharp");
    else watch.observe(h);
  });

  // The footer switch turns motion off mid-visit: show everything straight away.
  new MutationObserver(function () {
    if (!motionOff()) return;
    root.classList.remove("notes-ready", "sharp-ready");
  }).observe(root, { attributes: true, attributeFilter: ["data-motion"] });
})();

// Show a parent / ask your teacher. Uses the phone's share sheet when there
// is one, otherwise the link's own pre-written email. Collects nothing.
(function () {
  var links = document.querySelectorAll("[data-share]");
  if (!links.length || !navigator.share) return;
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      navigator
        .share({
          title: a.getAttribute("data-share-title"),
          text: a.getAttribute("data-share-text"),
          url: a.getAttribute("data-share-url"),
        })
        .catch(function () {});
    });
  });
})();

// Parents and teachers who arrive from a student's link get a short welcome.
(function () {
  try {
    if (new URLSearchParams(location.search).get("ref") !== "student") return;
  } catch (e) { return; }
  document.querySelectorAll("[data-from-student]").forEach(function (el) {
    el.hidden = false;
  });
})();

// Careers quiz. Runs in the browser only. Nothing is stored or sent.
(function () {
  var box = document.querySelector("[data-quiz]");
  if (!box) return;
  var stage = box.querySelector("[data-quiz-stage]");

  var questions = [
    { q: "It's a free Saturday. You're most likely to...", a: [
      ["Take something apart to see how it works", "builder"],
      ["Draw, edit a video or design something", "creator"],
      ["Get outside, somewhere new or with animals", "explorer"],
      ["Get stuck into a puzzle or a strategy game", "solver"],
      ["Find out how a scam you saw online actually worked", "protector"] ] },
    { q: "Pick a superpower.", a: [
      ["Spot patterns nobody else can see", "solver"],
      ["Never get lost, anywhere on Earth", "explorer"],
      ["Build anything you imagine in a day", "builder"],
      ["Know instantly when something's not right", "protector"],
      ["Make your drawings come to life", "creator"] ] },
    { q: "Your group project is due. You're the one who...", a: [
      ["Makes it look amazing", "creator"],
      ["Gets the thing actually working", "builder"],
      ["Checks nothing can go wrong", "protector"],
      ["Finds the facts nobody else found", "explorer"],
      ["Works out the numbers", "solver"] ] },
    { q: "You could watch an hour of...", a: [
      ["A heist film", "protector"],
      ["A nature documentary", "explorer"],
      ["How an animated film gets made", "creator"],
      ["Someone building a robot", "builder"],
      ["A detective cracking a case", "solver"] ] },
    { q: "You get to make one app. It's...", a: [
      ["A game all your friends are playing", "creator"],
      ["A live map of every bushfire in Australia", "explorer"],
      ["Something that stops scam texts for good", "protector"],
      ["A tool that predicts the footy results", "solver"],
      ["A robot that cleans your room", "builder"] ] },
    { q: "Your phone screen cracks. You...", a: [
      ["Watch a video and fix it yourself", "builder"],
      ["See it as an excuse for a new case design", "creator"],
      ["Check what's on it before anyone else touches it", "protector"],
      ["Head outside for the day anyway", "explorer"],
      ["Compare every repair option to find the best deal", "solver"] ] },
    { q: "Pick the excursion.", a: [
      ["A robotics lab", "builder"],
      ["A game or film studio", "creator"],
      ["A national park with the rangers", "explorer"],
      ["A lab full of microscopes and lasers", "solver"],
      ["A day with a bank's security team", "protector"] ] },
  ];

  var results = {
    builder: { title: "You're a builder", line: "You like making things that actually work.", jobs: [
      ["Computer vision engineer", "Builds systems that let phones, cars and drones understand images.", "career-vision"],
      ["Robotics engineer", "Designs robots for farms, mines, hospitals and space.", "career-robotics"],
      ["Mechatronics engineer", "Mixes electronics, mechanics and code to build smart machines."],
      ["Drone engineer", "Builds drones that map land, check crops and help in rescues."] ] },
    creator: { title: "You're a creator", line: "You like making things people see, feel and use.", jobs: [
      ["Technical artist", "Uses light, shadow and code to make flat screens look 3D.", "career-artist"],
      ["Game designer", "Invents the rules, worlds and challenges that make games fun.", "career-game"],
      ["UX designer", "Makes apps and websites easy and enjoyable to use.", "career-ux"],
      ["3D animator", "Brings characters and worlds to life for games, film and ads."] ] },
    explorer: { title: "You're an explorer", line: "You want to understand the real world, outside the screen.", jobs: [
      ["Behavioural ecologist", "Studies how animals survive, hide and fool predators.", "career-ecologist"],
      ["Remote sensing scientist", "Uses satellite and drone images to track forests, oceans and cities.", "career-remote"],
      ["Environmental data scientist", "Turns data about the planet into answers people can act on."],
      ["Conservation technologist", "Uses cameras, sensors and AI to protect wildlife."] ] },
    solver: { title: "You're a solver", line: "You like a hard question and a pattern nobody else has spotted.", jobs: [
      ["Data scientist", "Finds the story hiding in huge amounts of data.", "career-data"],
      ["Machine learning engineer", "Teaches computers to learn from examples."],
      ["Biophotonics researcher", "Works out how living things make colour and light.", "career-biophotonics"],
      ["Bioinformatician", "Uses code to read DNA and find patterns in living things."] ] },
    protector: { title: "You're a protector", line: "You notice when something's off, and you want to fix it.", jobs: [
      ["Cybersecurity analyst", "Keeps people, schools and companies safe from online attacks.", "career-cyber"],
      ["Penetration tester", "An ethical hacker, paid to find weak spots before criminals do."],
      ["Digital forensics investigator", "Follows digital clues to work out what happened."],
      ["Privacy engineer", "Builds apps so people's personal information stays safe."] ] },
  };
  var order = ["builder", "creator", "explorer", "solver", "protector"];
  var step = 0;
  var score = {};

  var dial = box.querySelector("[data-quiz-dial]");
  var dialText = box.querySelector("[data-quiz-dial-text]");
  var ring = 2 * Math.PI * 34;
  if (dial) dial.style.strokeDasharray = ring;
  function setDial(done, label) {
    if (dial) dial.style.strokeDashoffset = ring * (1 - done / questions.length);
    if (dialText) dialText.textContent = label;
    box.classList.toggle("is-done", done === questions.length);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function showQuestion() {
    var item = questions[step];
    stage.innerHTML = "";
    setDial(step, (step + 1) + "/" + questions.length);
    var h = el("p", "quiz-q", item.q);
    h.tabIndex = -1;
    var list = el("div", "quiz-options");
    item.a.forEach(function (opt) {
      var b = el("button", "quiz-option");
      b.appendChild(el("span", "quiz-option-mark", "ABCDE".charAt(item.a.indexOf(opt))));
      b.appendChild(el("span", "", opt[0]));
      b.type = "button";
      b.addEventListener("click", function () {
        score[opt[1]] = (score[opt[1]] || 0) + 1;
        step++;
        if (step < questions.length) showQuestion();
        else showResult();
      });
      list.appendChild(b);
    });
    stage.append(h, list);
    if (step > 0) h.focus();
  }

  function ranked() {
    return order.slice().sort(function (x, y) {
      return (score[y] || 0) - (score[x] || 0) || order.indexOf(x) - order.indexOf(y);
    });
  }

  function jobItem(j) {
    var li = el("li");
    li.appendChild(el("strong", "", j[0]));
    li.appendChild(el("span", "", j[1]));
    if (j[2]) {
      var a = el("a", "quiz-jump", "See this career");
      a.href = "#" + j[2];
      a.addEventListener("click", function () {
        var d = document.getElementById(j[2]);
        if (d) d.open = true;
      });
      li.appendChild(a);
    }
    return li;
  }

  function showResult() {
    var top = ranked();
    var r = results[top[0]];
    var second = results[top[1]];
    setDial(questions.length, "Done");
    stage.innerHTML = "";
    var h = el("p", "quiz-result-title", r.title);
    h.tabIndex = -1;
    var line = el("p", "quiz-result-line", r.line);
    var list = el("ul", "quiz-jobs");
    r.jobs.forEach(function (j) { list.appendChild(jobItem(j)); });
    var also = el("div", "quiz-also");
    also.appendChild(el("p", "quiz-also-title", (score[top[1]] || 0) > 0 ? "Also worth a look, because you're part " + second.title.replace("You're a ", "").toLowerCase() : "Also worth a look"));
    var alsoList = el("ul", "quiz-jobs quiz-jobs--small");
    second.jobs.slice(0, 2).forEach(function (j) { alsoList.appendChild(jobItem(j)); });
    also.appendChild(alsoList);
    var again = el("button", "quiz-again", "Take it again");
    again.type = "button";
    again.addEventListener("click", function () {
      step = 0;
      score = {};
      showQuestion();
      stage.querySelector(".quiz-q").focus();
    });
    stage.append(h, line, list, also, again);
    h.focus();
  }

  showQuestion();
})();
