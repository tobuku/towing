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

  /* ---- Pointer glow + magnetic STICK cursor ---- */
  function setPointerGlow(el, e) {
    var r = el.getBoundingClientRect();
    el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
  }

  if (hoverOk) {
    document.querySelectorAll(".kls-magnet, .btn").forEach(function (el) {
      var stuck = false;
      var stickZone = 80; /* px radius around element that triggers stick */

      function getCenter(rect) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }

      /* Stick: element follows cursor tightly within zone */
      el.addEventListener("mousemove", function (e) {
        setPointerGlow(el, e);
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        stuck = true;
        gsap.to(el, {
          x: dx * 0.65,
          y: dy * 0.65,
          scale: 1.1,
          duration: 0.25,
          ease: "power3.out",
        });
      });

      /* Release: snap back with dramatic elastic */
      el.addEventListener("mouseleave", function () {
        stuck = false;
        gsap.to(el, {
          x: 0,
          y: 0,
          scale: 1,
          duration: 1.0,
          ease: "elastic.out(1.2, 0.3)",
        });
      });

      el.addEventListener("pointerdown", function () {
        gsap.to(el, { scale: 0.88, duration: 0.1, ease: "power2.out" });
      });
      el.addEventListener("pointerup", function () {
        gsap.to(el, { scale: 1.1, duration: 0.4, ease: "elastic.out(1.2, 0.35)" });
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
