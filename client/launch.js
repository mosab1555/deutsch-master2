/* Deutsch Master - launch flow (additive). Shows splash every launch, welcome on first run only. */
(function () {
  /* Reliable SW updates for long-lived SPA sessions (in-app navigation does
     not trigger the browser's update check): re-check at most once per hour
     when the tab becomes visible. Single registration, no reload, no loops. */
  var dmSWReg = null, dmSWLastCheck = 0;
  function dmSWCheckUpdate() {
    try {
      if (!dmSWReg || !dmSWReg.update) return;
      var now = Date.now();
      if (now - dmSWLastCheck < 3600000) return;
      dmSWLastCheck = now;
      dmSWReg.update().catch(function () {});
    } catch (e) {}
  }
  try {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        if (dmSWReg) return;
        navigator.serviceWorker.register("sw.js").then(function (reg) {
          dmSWReg = reg; dmSWLastCheck = Date.now();
        }).catch(function () {});
      });
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) dmSWCheckUpdate();
      });
    }
  } catch (e) {}
  function flag() { return '<span class="dm-flag"><i></i><i></i><i></i></span>'; }
  function logo() { return '<div class="dm-logo"><b>DE</b>' + flag() + '</div>'; }
  var sp = document.createElement("div");
  sp.id = "dmSplash";
  sp.innerHTML = logo() + '<div class="dm-name">Deutsch Master</div><div class="dm-tag">Learn German. Master Your Future.</div><div class="dm-loader"></div>';
  document.body.appendChild(sp);
  function welcomed() { try { return localStorage.getItem("dm_welcomed") === "1"; } catch (e) { return true; } }
  setTimeout(function () {
    sp.classList.add("dm-hide");
    setTimeout(function () { sp.remove(); if (!welcomed()) showWelcome(); }, 480);
  }, 1500);
  function showWelcome() {
    var w = document.createElement("div");
    w.id = "dmWelcome";
    w.innerHTML = '<div class="dm-card">' + logo() +
      '<div class="dm-hello">Willkommen! 🇩🇪</div>' +
      '<div class="dm-name" style="font-size:24px">Deutsch Master</div>' +
      '<div class="dm-tag">Your German journey starts here.</div>' +
      '<div class="dm-feats"><span>📚 800+ كلمة</span><span>📝 اختبارات</span><span>🔥 Streak</span></div>' +
      '<button class="dm-start" id="dmStartBtn">Start Learning →</button></div>';
    document.body.appendChild(w);
    document.getElementById("dmStartBtn").addEventListener("click", function () {
      try { localStorage.setItem("dm_welcomed", "1"); } catch (e) {}
      w.classList.add("dm-hide");
      setTimeout(function () { w.remove(); }, 480);
    });
  }
})();
