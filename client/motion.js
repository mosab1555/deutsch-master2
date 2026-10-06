/* Deutsch Master — motion engine (additive only).
   - .mo-enter window on freshly activated pages (stagger runs once per nav,
     never on innerHTML re-renders like live search).
   - Hero particle field (aria-hidden, transform-only, injected once).
   - Subtle hero parallax (rAF, desktop fine-pointer, capped).
   - XP burst chip near #xpNum on value increase (removed after 1s).
   - Favorite heart pop on activation.
   Read-only DOM + class toggles. Never touches storage, data, audio,
   navigation, scoring or any existing handler. */
(function () {
  "use strict";
  var reduceMotion = false, finePointer = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  try { finePointer = window.matchMedia("(pointer: fine)").matches; } catch (e) {}
  function $(id) { try { return document.getElementById(id); } catch (e) { return null; } }

  /* ---------- enter window per navigation ---------- */
  var lastActive = null, enterTimer = 0;
  function markEnter() {
    try {
      var active = document.querySelector(".page.active");
      if (!active || active === lastActive) return;
      if (lastActive) { try { lastActive.classList.remove("mo-enter"); } catch (e) {} }
      lastActive = active;
      if (reduceMotion) return;
      active.classList.add("mo-enter");
      if (enterTimer) clearTimeout(enterTimer);
      enterTimer = setTimeout(function () {
        try { active.classList.remove("mo-enter"); } catch (e) {}
      }, 700);
    } catch (e) {}
  }
  try {
    markEnter();
    var content = document.querySelector(".content");
    if ("MutationObserver" in window && content) {
      new MutationObserver(markEnter).observe(content, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("click", function () { setTimeout(markEnter, 80); }, true);
  } catch (e) {}

  /* ---------- hero particles (decorative, hidden from AT) ---------- */
  try {
    if (!reduceMotion && !window.__dmParticles) {
      window.__dmParticles = true;
      var hero = document.querySelector(".cmd-hero");
      if (hero) {
        var field = document.createElement("div");
        field.className = "dm-particles";
        field.setAttribute("aria-hidden", "true");
        var html = "";
        for (var i = 0; i < 10; i++) {
          var left = (7 + ((i * 37) % 86)).toFixed(1);
          var top = (8 + ((i * 53) % 80)).toFixed(1);
          var size = 5 + ((i * 7) % 9);
          var delay = (-(i * 1.1)).toFixed(1);
          var dur = (7 + ((i * 3) % 5)).toFixed(1);
          html += '<i style="left:' + left + '%;top:' + top + '%;width:' + size + 'px;height:' + size +
            'px;animation-delay:' + delay + 's;animation-duration:' + dur + 's"></i>';
        }
        field.innerHTML = html;
        hero.insertBefore(field, hero.firstChild);
      }
    }
  } catch (e) {}

  /* ---------- subtle hero parallax ---------- */
  try {
    if (!reduceMotion && finePointer) {
      var visual = document.querySelector(".hm-visual"), raf = 0;
      var onScroll = function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          try {
            var dash = $("page-dashboard");
            if (!visual || !dash || !dash.classList.contains("active")) {
              if (visual) visual.style.transform = "";
              return;
            }
            var y = Math.max(-12, Math.min(12, (window.scrollY || 0) * -0.04));
            visual.style.transform = y ? "translateY(" + y.toFixed(1) + "px)" : "";
          } catch (e2) {}
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  } catch (e) {}

  /* ---------- XP burst on increase ---------- */
  try {
    var xpEl = $("xpNum"), lastXp = -1;
    if (xpEl && "MutationObserver" in window) {
      var num = function () { var v = parseInt((xpEl.textContent || "0").replace(/\D/g, ""), 10); return isNaN(v) ? 0 : v; };
      lastXp = num();
      new MutationObserver(function () {
        try {
          var v = num();
          if (v > lastXp && !reduceMotion) {
            var r = xpEl.getBoundingClientRect();
            var chip = document.createElement("span");
            chip.className = "mo-xp-burst";
            chip.textContent = "+" + (v - lastXp) + " XP";
            chip.style.position = "fixed";
            chip.style.left = Math.max(8, r.left + r.width / 2 - 30) + "px";
            chip.style.top = Math.max(8, r.top - 26 + (window.scrollY || 0) * 0) + "px";
            document.body.appendChild(chip);
            setTimeout(function () { try { chip.remove(); } catch (e) {} }, 1050);
          }
          lastXp = v;
        } catch (e) {}
      }).observe(xpEl, { childList: true, characterData: true, subtree: true });
    }
  } catch (e) {}

  /* ---------- favorite heart pop ---------- */
  try {
    if (!reduceMotion && "MutationObserver" in window && document.body) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          try {
            var t = m.target;
            if (t && t.classList && t.classList.contains("fav") && t.classList.contains("active") && !t.classList.contains("mo-pop")) {
              t.classList.add("mo-pop");
              setTimeout(function () { try { t.classList.remove("mo-pop"); } catch (e) {} }, 450);
            }
          } catch (e) {}
        });
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  } catch (e) {}
})();
