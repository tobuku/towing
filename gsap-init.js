/* Tadio's Towing - Shared GSAP animations */
(function () {
  /* Year in footer */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!window.gsap || !window.ScrollTrigger) return;

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);

  var hoverOk =
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- Split-letter utility ---- */
  function splitLetters(el) {
    if (!el || el.dataset.split === "1") return;
    var text = el.textContent || "";
    el.textContent = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = "kls-char";
      s.textContent = text[i] === " " ? "\u00A0" : text[i];
      frag.appendChild(s);
    }
    el.appendChild(frag);
    el.classList.add("kls-split");
    el.dataset.split = "1";
  }

  /* ---- Drop-bounce headings ---- */
  function dropBounceHeading(el, strength) {
    splitLetters(el);
    var chars = el.querySelectorAll(".kls-char");
    if (!chars.length) return;
    function play() {
      gsap.fromTo(
        chars,
        { y: -120 * strength, opacity: 0, scale: 0.3, rotation: -15, filter: "blur(14px)" },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          rotation: 0,
          filter: "blur(0px)",
          duration: 1.4,
          ease: "elastic.out(1, 0.4)",
          stagger: 0.035,
        }
      );
    }
    ScrollTrigger.create({
      trigger: el,
      start: "top 86%",
      onEnter: play,
      onEnterBack: play,
    });
  }

  document.querySelectorAll(".kls-drop").forEach(function (el) {
    var tag = (el.tagName || "").toLowerCase();
    var strength = tag === "h1" ? 1.6 : tag === "h2" ? 1.3 : 1.1;
    dropBounceHeading(el, strength);
  });

  /* ---- Fade-in on scroll ---- */
  gsap.utils.toArray(".kls-fade").forEach(function (el) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 80, scale: 0.92 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          end: "bottom 20%",
          toggleActions: "play reverse play reverse",
        },
      }
    );
  });

  /* ---- Pointer glow + magnetic cursor ---- */
  function setPointerGlow(el, e) {
    var r = el.getBoundingClientRect();
    el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  }

  if (hoverOk) {
    document.querySelectorAll(".kls-magnet, .btn").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        setPointerGlow(el, e);
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        gsap.to(el, {
          x: x * 0.45,
          y: y * 0.45,
          scale: 1.08,
          duration: 0.2,
          ease: "power2.out",
        });
      });
      el.addEventListener("mouseleave", function () {
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.7,
          ease: "elastic.out(1, 0.25)",
        });
      });
      el.addEventListener("pointerdown", function () {
        gsap.to(el, { scale: 0.92, duration: 0.1, ease: "power2.out" });
      });
      el.addEventListener("pointerup", function () {
        gsap.to(el, { scale: 1.08, duration: 0.35, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ---- Image hover highlight ---- */
  document.querySelectorAll(".media img").forEach(function (img) {
    img.addEventListener("mouseenter", function () {
      gsap.to(img, {
        filter: "brightness(1.15) saturate(1.1)",
        scale: 1.03,
        duration: 0.4,
        ease: "power1.out",
      });
    });
    img.addEventListener("mouseleave", function () {
      gsap.to(img, {
        filter: "brightness(1) saturate(1)",
        scale: 1,
        duration: 0.4,
        ease: "power1.out",
      });
    });
  });

  /* ---- Mobile nav toggle ---- */
  var toggle = document.querySelector(".nav-toggle");
  var navLinks = document.querySelector(".nav-links");
  if (toggle && navLinks) {
    toggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
      toggle.setAttribute(
        "aria-expanded",
        navLinks.classList.contains("open")
      );
    });
  }
})();
