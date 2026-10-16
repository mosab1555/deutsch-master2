/* Deutsch Master — Academy Portal UI (Phase 1, additive, fail-closed).
 *
 * Renders the functional academy administration + teacher experience inside
 * client/academy.html WITHOUT touching the learner application: learner
 * pages, script.js, progress, sync, and guest isolation are never modified
 * here. Every control is wired to AcademyCore (fail-closed target gate) with
 * identity from the dedicated Staging session (AcademyAuth) — never the
 * Production learner auth;
 * when the migration is not applied, the portal shows an honest setup status
 * and disables writes instead of pretending success. No invented grades,
 * attendance, or engagement metrics: reports derive only from
 * user_progress.state via AcademyCore.aggregateProgress with explicit empty
 * states. Bounded requests everywhere (PAGE_SIZE pagination, single-student
 * progress fetches for the visible page only).
 */
"use strict";

(function () {
"use strict";

/* Additive portal chrome translations (same I18N system as study.js; merged
   at load when I18N exists; check-translations.js merges this block
   statically like labsx/adv/reference/howto). */
try {
  if (typeof I18N !== "undefined" && I18N && I18N.ar && I18N.en && I18N.de) {
    Object.assign(I18N.ar, {acad_nav_grp:"🏫 بوابة الأكاديمية",acad_nav_overview:"نظرة الأكاديمية",acad_nav_settings:"الملف والإعدادات",acad_nav_teachers:"المعلمون والأعضاء",acad_nav_classes:"الفصول",acad_nav_enroll:"التسجيل",acad_nav_teacher:"لوحة المعلم",acad_sec_overview:"🏫 نظرة الأكاديمية",acad_refresh:"🔄 تحديث",acad_summary:"الملخص",acad_scope1_t:"نطاق المرحلة 1 (بصدق)",acad_scope1_d:"إدارة الأكاديمية والفصول والتسجيل ولوحة المعلم تعمل ببيانات حقيقية عند تهيئة قاعدة البيانات (staging فقط). الدفع والشهادات والنطاقات المخصصة خارج النطاق. المحتوى غير معتمد بعد، والامتحانات داخلية.",acad_sec_settings:"⚙️ الملف والإعدادات",acad_sec_teachers:"🧑‍🏫 المعلمون والأعضاء",acad_sec_classes:"🏷️ الفصول",acad_sec_enroll:"🎓 التسجيل",acad_sec_teacher:"📊 لوحة المعلم"});
    Object.assign(I18N.en, {acad_nav_grp:"🏫 Academy portal",acad_nav_overview:"Academy overview",acad_nav_settings:"Profile and settings",acad_nav_teachers:"Teachers and members",acad_nav_classes:"Classes",acad_nav_enroll:"Enrollment",acad_nav_teacher:"Teacher dashboard",acad_sec_overview:"🏫 Academy overview",acad_refresh:"Refresh",acad_summary:"Summary",acad_scope1_t:"Phase 1 scope (honest)",acad_scope1_d:"Academy, class, enrollment, and teacher sections run on real data once the database is configured (staging only). Payments, certificates, and custom domains are out of scope. Content is unreviewed; exams are internal.",acad_sec_settings:"Profile and settings",acad_sec_teachers:"Teachers and members",acad_sec_classes:"Classes",acad_sec_enroll:"Enrollment",acad_sec_teacher:"Teacher dashboard"});
    Object.assign(I18N.de, {acad_nav_grp:"🏫 Akademie-Portal",acad_nav_overview:"Akademie-Ueberblick",acad_nav_settings:"Profil und Einstellungen",acad_nav_teachers:"Lehrer und Mitglieder",acad_nav_classes:"Klassen",acad_nav_enroll:"Einschreibung",acad_nav_teacher:"Lehrer-Dashboard",acad_sec_overview:"🏫 Akademie-Ueberblick",acad_refresh:"Aktualisieren",acad_summary:"Ueberblick",acad_scope1_t:"Phase-1-Umfang (ehrlich)",acad_scope1_d:"Akademie-, Klassen-, Einschreibungs- und Lehrerbereiche nutzen echte Daten, sobald die Datenbank konfiguriert ist (nur Staging). Zahlungen, Zertifikate und Custom-Domains sind ausgenommen. Inhalte ungeprueft; Pruefungen intern.",acad_sec_settings:"Profil und Einstellungen",acad_sec_teachers:"Lehrer und Mitglieder",acad_sec_classes:"Klassen",acad_sec_enroll:"Einschreibung",acad_sec_teacher:"Lehrer-Dashboard"});
  }
} catch (e) {}

  if (typeof window === "undefined") return;

  var S = {
    setup: null, user: null, memberships: [], currentAcademy: null, role: null,
    overview: { page: 1 }, teachers: { page: 1, search: "" }, classes: { page: 1, search: "" },
    enroll: { classId: null, page: 1 }, teacherDash: { classId: null, page: 1, detail: null }
  };

  function esc(s) {
    var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return map[c]; });
  }
  function lang() {
    try {
      var L = (typeof uilang === "function") ? uilang() : ((window.S && window.S.uiLang) || "ar");
      if (L === "en" || L === "de") return L;
    } catch (e) {}
    return "ar";
  }
  // Minimal portal strings (portal-only; learner I18N in study.js untouched).
  var STR = {
    ar: {
      setupOk: "🟢 قاعدة بيانات الأكاديمية جاهزة ومتصلة.",
      setupMissing: "🟡 قاعدة بيانات الأكاديمية غير مُهيأة بعد: لم يُطبَّق ملف الترحيل على Supabase. القراءة والكتابة معطلة هنا — راجع تقرير المرحلة.",
      targetDisabled: "🚫 بوابة الأكاديمية معطلة على هذا النشر: هذا النشر يستخدم مشروع الإنتاج لتطبيق المتعلم، وجداول الأكاديمية لا تُستخدم عبر الإنتاج أبدًا. يلزم اتصال Staging منفصل — وهو غير مُكوَّن هنا. تطبيق المتعلم يعمل بشكل طبيعي.",
      noSupabase: "⚠️ Supabase غير مُهيأ في هذا المتصفح: التطبيق يعمل دون اتصال، وبوابة الأكاديمية للعرض فقط.",
      signin: "سجّل الدخول بحساب الأكاديمية أعلاه لاستخدام البوابة. وضع الضيف لا يملك صلاحيات إدارية.",
      acadAuthTitle: "تسجيل دخول الأكاديمية",
      acadEmailPh: "البريد الإلكتروني للأكاديمية",
      acadPassPh: "كلمة المرور",
      acadSignIn: "تسجيل الدخول",
      acadSignOut: "تسجيل الخروج من الأكاديمية",
      acadSignedInAs: "مسجّل الدخول بصفة:",
      acadSigninRequired: "سجّل الدخول بحساب أكاديمية مُعدّ من المشغّل لاستخدام البوابة. الحسابات تُنشأ من المشغّل فقط — لا يوجد تسجيل ذاتي.",
      acadInconsistent: "اتصال الأكاديمية غير متسق: هدف العميل لا يطابق الهدف المُكوَّن. لا تُنفَّذ أي استعلامات.",
      acadInvalidCredentials: "بيانات دخول الأكاديمية غير صحيحة: تحقق من البريد الإلكتروني وكلمة المرور.",
      acadDenied: "مرفوض: ليس لديك صلاحية لهذا الإجراء في الأكاديمية.",
      noMember: "لا توجد عضوية أكاديمية لحسابك بعد. اطلب من مالك المنصة أو مدير الأكاديمية إضافتك عبر User ID.",
      myId: "معرّف المستخدم الخاص بك (انسخه وأرسله للمدير):",
      overview: "نظرة عامة", settings: "الملف والإعدادات", teachers: "المعلمون والأعضاء",
      classes: "الفصول", enroll: "التسجيل", teacherDash: "لوحة المعلم"
    },
    en: {
      setupOk: "🟢 Academy database is ready and connected.",
      setupMissing: "🟡 Academy database is not configured yet: the migration was not applied. Reads/writes are disabled here — see the phase report.",
      targetDisabled: "Academy portal is disabled on this deployment: this deployment uses the Production project for the learner app, and Academy tables are never queried via Production. A separate Staging connection is required — it is not configured here. The learner app works normally.",
      noSupabase: "⚠️ Supabase is not configured in this browser: the app works offline; the academy portal is view-only.",
      signin: "Sign in with your Academy account above to use the portal. Guest mode has no admin rights.",
      acadAuthTitle: "Academy sign-in",
      acadEmailPh: "Academy email",
      acadPassPh: "Password",
      acadSignIn: "Sign in",
      acadSignOut: "Sign out of Academy",
      acadSignedInAs: "Signed in as:",
      acadSigninRequired: "Sign in with an operator-provisioned Academy account to use the portal. Accounts are operator-created only — no self-signup.",
      acadInconsistent: "Academy connection is inconsistent: the client target does not match the configured target. No queries are issued.",
      acadInvalidCredentials: "Invalid Academy credentials: check the email and password.",
      acadDenied: "Permission denied: you lack Academy permission for this action.",
      noMember: "Your account has no academy membership yet. Ask a platform owner or academy manager to add you via User ID.",
      myId: "Your User ID (copy and send it to the manager):",
      overview: "Overview", settings: "Profile & settings", teachers: "Teachers & members",
      classes: "Classes", enroll: "Enrollment", teacherDash: "Teacher dashboard"
    },
    de: {
      setupOk: "🟢 Akademie-Datenbank ist bereit und verbunden.",
      setupMissing: "🟡 Akademie-Datenbank ist noch nicht konfiguriert: Die Migration wurde nicht angewendet.",
      targetDisabled: "Akademie-Portal ist auf diesem Deployment deaktiviert: Dieses Deployment nutzt das Produktionsprojekt für die Lern-App, und Akademie-Tabellen werden niemals über Produktion abgefragt. Eine separate Staging-Verbindung ist erforderlich — sie ist hier nicht konfiguriert. Die Lern-App funktioniert normal.",
      noSupabase: "⚠️ Supabase ist in diesem Browser nicht konfiguriert: Die App arbeitet offline; das Portal ist nur Ansicht.",
      signin: "Melde dich oben mit deinem Akademie-Konto an, um das Portal zu nutzen. Gastmodus hat keine Admin-Rechte.",
      acadAuthTitle: "Akademie-Anmeldung",
      acadEmailPh: "Akademie-E-Mail",
      acadPassPh: "Passwort",
      acadSignIn: "Anmelden",
      acadSignOut: "Von Akademie abmelden",
      acadSignedInAs: "Angemeldet als:",
      acadSigninRequired: "Melde dich mit einem vom Betreiber erstellten Akademie-Konto an. Konten werden nur vom Betreiber erstellt — keine Selbstregistrierung.",
      acadInconsistent: "Akademie-Verbindung ist inkonsistent: Das Client-Ziel stimmt nicht mit dem konfigurierten Ziel überein. Es werden keine Abfragen ausgeführt.",
      acadInvalidCredentials: "Ungültige Akademie-Anmeldedaten: E-Mail und Passwort prüfen.",
      acadDenied: "Zugriff verweigert: Keine Akademie-Berechtigung für diese Aktion.",
      noMember: "Dein Konto hat noch keine Akademie-Mitgliedschaft. Bitte einen Plattform-Owner oder Manager um Hinzufügen per User-ID.",
      myId: "Deine User-ID (kopieren und an den Manager senden):",
      overview: "Überblick", settings: "Profil & Einstellungen", teachers: "Lehrer & Mitglieder",
      classes: "Klassen", enroll: "Einschreibung", teacherDash: "Lehrer-Dashboard"
    }
  };
  function tr(k) {
    try { return (STR[lang()] && STR[lang()][k]) || STR.ar[k] || k; } catch (e) { return k; }
  }

  function el(id) { return document.getElementById(id); }
  function toast(msg, kind) {
    try { if (window.toast) window.toast(msg, kind); else console.log("[Academy]", msg); }
    catch (e) { console.log("[Academy]", msg); }
  }

  function statusBanner() {
    var b = el("acadSetupBanner");
    if (!b) return;
    var s = S.setup;
    if (!s) { b.innerHTML = '<div class="muted">…</div>'; return; }
    if (!s.configured && s.reason === "supabase_not_configured") {
      b.innerHTML = '<div class="panel glass" style="border-color:#a80">⚠️ ' + esc(tr("noSupabase")) + "</div>";
    } else if (!s.configured && (s.reason === "target_disabled" || (s.code === "TARGET_DISABLED"))) {
      // Fail-closed deployment state: Production target never queries Academy
      // tables. Never claim a Staging connection exists when it does not.
      b.innerHTML = '<div class="panel glass" style="border-color:#a33">🚫 ' + esc(tr("targetDisabled")) +
        '<div class="muted">Academy target gate: explicit Staging ref required; Production is default-deny.</div></div>';
    } else if (!s.configured && (s.reason === "inconsistent_target" || (s.code === "INCONSISTENT_TARGET"))) {
      b.innerHTML = '<div class="panel glass" style="border-color:#a33">🚫 ' + esc(tr("acadInconsistent")) + "</div>";
    } else if (!s.configured && (s.reason === "signin_required" || (s.code === "SIGNIN_REQUIRED"))) {
      b.innerHTML = '<div class="panel glass" style="border-color:#a80">🔑 ' + esc(tr("acadSigninRequired")) + "</div>";
    } else if (!s.configured) {
      b.innerHTML = '<div class="panel glass" style="border-color:#a80">🟡 ' + esc(tr("setupMissing")) +
        '<div class="muted">supabase/migrations/20261015000000_academy_core.sql — staging only, never production.</div></div>';
    } else {
      b.innerHTML = '<div class="panel glass" style="border-color:#0a4">🟢 ' + esc(tr("setupOk")) + "</div>";
    }
    var my = el("acadMyUid");
    if (my) {
      var u = S.user;
      my.innerHTML = u && u.id
        ? '<span class="muted">' + esc(tr("myId")) + '</span> <code dir="ltr">' + esc(u.id) + '</code> ' +
          '<button class="btn btn-ghost sm" id="acadCopyUid">📋 نسخ</button>'
        : '<span class="muted">' + esc(tr("signin")) + ' <a href="index.html">index.html</a></span>';
      var cp = el("acadCopyUid");
      if (cp) cp.addEventListener("click", function () {
        try { navigator.clipboard.writeText(u.id); toast("✅ copied", "ok"); } catch (e) { toast(u.id, "ok"); }
      });
    }
  }

  function roleLabel(r) {
    return { platform_owner: "platform_owner 👑", academy_owner: "academy_owner 👑", academy_admin: "academy_admin 🛡️",
      teacher: "teacher 🧑‍🏫", student: "student 🎓" }[r] || r;
  }

  // Dedicated Academy identity: the Staging session owned by AcademyAuth.
  function academyUser() {
    try {
      if (window.AcademyAuth && typeof window.AcademyAuth.getUser === "function") {
        return window.AcademyAuth.getUser() || null;
      }
    } catch (e) {}
    return null;
  }

  // Single stale-state reset: clears cached identity, selection, role, and
  // all cached teacher/class/enrollment/progress view state, plus every
  // rendered container so old UIDs, academy IDs, class lists, and progress
  // are no longer visible. Never shows a prior UID as authenticated when
  // the Academy session is unavailable.
  function resetPortalState(reason) {
    try { S.user = null; } catch (e) {}
    try { S.memberships = []; } catch (e2) {}
    try { S.currentAcademy = null; } catch (e3) {}
    try { S.role = null; } catch (e4) {}
    try { S.overview = { page: 1 }; } catch (e5) {}
    try { S.teachers = { page: 1, search: "" }; } catch (e6) {}
    try { S.classes = { page: 1, search: "" }; } catch (e7) {}
    try { S.enroll = { classId: null, page: 1 }; } catch (e8) {}
    try { S.teacherDash = { classId: null, page: 1, detail: null }; } catch (e9) {}
    var bodies = ["acadSelector", "acadOverviewBody", "acadSettingsBody",
      "acadTeachersBody", "acadClassesBody", "acadEnrollBody", "acadTeacherBody"];
    for (var i = 0; i < bodies.length; i++) {
      try {
        var n = el(bodies[i]);
        if (n) n.innerHTML = '<div class="muted">…</div>';
      } catch (e10) {}
    }
    try {
      var my = el("acadMyUid");
      if (my) my.innerHTML = '<span class="muted">' + esc(tr("signin")) + "</span>";
    } catch (e11) {}
    try {
      if (typeof window !== "undefined" && window) {
        window.__academyPortalResetReason = reason || "reset";
      }
    } catch (e12) {}
  }

  async function refreshAll() {
    var C = window.AcademyCore;
    if (!C) return;
    var initStatus = null;
    try {
      if (window.AcademyAuth && typeof window.AcademyAuth.initialize === "function") {
        initStatus = await window.AcademyAuth.initialize();
      }
    } catch (e) { initStatus = null; }
    if (!initStatus || !initStatus.configured) {
      // Initialization failed or target disabled/inconsistent: clear stale
      // selection, role, UID, and rendered data; show safe status only.
      resetPortalState(!initStatus ? "init_failed" : initStatus.reason);
      try { S.setup = await C.checkSetup(); } catch (e) { S.setup = { configured: false, reason: "target_disabled" }; }
      renderSelector();
      statusBanner();
      renderAuthBox();
      await Promise.all([renderOverview(), renderSettings(), renderTeachers(), renderClasses(), renderEnroll(), renderTeacherDash()]);
      return;
    }
    // Fresh session check (never trust a stale cached user alone).
    var freshUser = null;
    try {
      if (window.AcademyAuth && typeof window.AcademyAuth.validateSession === "function") {
        var sess = await window.AcademyAuth.validateSession();
        freshUser = (sess && sess.user) || null;
      } else {
        freshUser = academyUser();
      }
    } catch (e) { freshUser = null; }
    if (!freshUser) {
      resetPortalState("no_session");
      try { S.setup = await C.checkSetup(); } catch (e2) { S.setup = { configured: false, reason: "signin_required" }; }
      renderSelector();
      statusBanner();
      renderAuthBox();
      await Promise.all([renderOverview(), renderSettings(), renderTeachers(), renderClasses(), renderEnroll(), renderTeacherDash()]);
      return;
    }
    try { S.user = freshUser; }
    catch (e) { S.user = null; }
    try { S.setup = await C.checkSetup(); } catch (e3) { S.setup = null; }
    if (S.setup && !S.setup.configured &&
      (S.setup.code === "TARGET_DISABLED" || S.setup.code === "INCONSISTENT_TARGET" ||
       S.setup.reason === "target_disabled" || S.setup.reason === "inconsistent_target")) {
      var keepSetup = S.setup;
      resetPortalState("target_invalid");
      S.setup = keepSetup;
      renderSelector();
      statusBanner();
      renderAuthBox();
      await Promise.all([renderOverview(), renderSettings(), renderTeachers(), renderClasses(), renderEnroll(), renderTeacherDash()]);
      return;
    }
    if (S.setup && S.setup.configured && S.user) {
      var m = await C.myMemberships();
      if (m && (m.code === "TARGET_DISABLED" || m.code === "INCONSISTENT_TARGET" || m.code === "SIGNIN_REQUIRED")) {
        var keepSetup2 = S.setup;
        resetPortalState("target_invalid");
        S.setup = keepSetup2;
        renderSelector();
        statusBanner();
        renderAuthBox();
        await Promise.all([renderOverview(), renderSettings(), renderTeachers(), renderClasses(), renderEnroll(), renderTeacherDash()]);
        return;
      }
      S.memberships = (m && m.data) || [];
    } else {
      S.memberships = [];
    }
    if (!S.currentAcademy && S.memberships.length) S.currentAcademy = S.memberships[0].academy_id;
    // Drop a stale selection that no longer has a membership.
    var stillMember = false;
    if (S.currentAcademy) {
      for (var k = 0; k < S.memberships.length; k++) {
        if (S.memberships[k].academy_id === S.currentAcademy) { stillMember = true; break; }
      }
      if (!stillMember) S.currentAcademy = S.memberships.length ? S.memberships[0].academy_id : null;
    }
    S.role = null;
    if (S.currentAcademy) {
      for (var i = 0; i < S.memberships.length; i++) {
        if (S.memberships[i].academy_id === S.currentAcademy) S.role = S.memberships[i].role;
      }
    }
    renderSelector();
    statusBanner();
    renderAuthBox();
    await Promise.all([renderOverview(), renderSettings(), renderTeachers(), renderClasses(), renderEnroll(), renderTeacherDash()]);
  }

  // Dedicated Academy sign-in/status box (Staging-only, operator accounts).
  // Rendered dynamically so static HTML needs no new translation keys.
  function renderAuthBox() {
    var box = el("acadAuthBox");
    if (!box) return;
    var A = null;
    try { A = window.AcademyAuth || null; } catch (e) {}
    var st = null;
    try { st = A && typeof A.getStatus === "function" ? A.getStatus() : null; } catch (e) {}
    if (!A || !st || !st.configured) {
      box.innerHTML = '<div class="muted">🚫 ' + esc(tr("targetDisabled")) + "</div>";
      return;
    }
    var u = null;
    try { u = academyUser(); } catch (e) {}
    if (!u) {
      box.innerHTML =
        '<h4>🔑 ' + esc(tr("acadAuthTitle")) + '</h4>' +
        '<div class="form-group"><input id="acadAuthEmail" class="full-input" dir="ltr" autocomplete="username" placeholder="' + esc(tr("acadEmailPh")) + '"></div>' +
        '<div class="form-group"><input id="acadAuthPass" type="password" class="full-input" dir="ltr" autocomplete="current-password" placeholder="' + esc(tr("acadPassPh")) + '"></div>' +
        '<div class="row-flex"><button class="btn btn-primary sm" id="acadAuthGo">' + esc(tr("acadSignIn")) + '</button></div>' +
        '<div class="muted" id="acadAuthMsg"></div>';
      var go = el("acadAuthGo");
      if (go) go.addEventListener("click", async function () {
        var msg = el("acadAuthMsg");
        var em = "", pw = "";
        try { em = el("acadAuthEmail").value; pw = el("acadAuthPass").value; } catch (e) {}
        if (msg) msg.textContent = "…";
        var r = await A.signInWithPassword(em, pw);
        if (r && r.error) {
          // Failed sign-in must not keep showing the previous user's
          // identity or data: clear cached UI and force safe revalidation.
          resetPortalState("signin_failed");
          statusBanner();
          renderAuthBox();
          var msg2 = el("acadAuthMsg");
          if (msg2) msg2.textContent = "⛔ " + tr("acadInvalidCredentials") + " " + String(r.error).slice(0, 200);
          refreshAll();
        } else {
          if (msg) msg.textContent = "";
          refreshAll();
        }
      });
      return;
    }
    var label = "";
    try { label = u.email || u.id || ""; } catch (e) {}
    box.innerHTML =
      '<div class="muted">' + esc(tr("acadSignedInAs")) + ' <code dir="ltr">' + esc(String(label).slice(0, 80)) + '</code></div>' +
      '<div class="row-flex"><button class="btn btn-ghost sm" id="acadAuthOut">' + esc(tr("acadSignOut")) + '</button></div>' +
      '<div class="muted" id="acadAuthMsg"></div>';
    var out = el("acadAuthOut");
    if (out) out.addEventListener("click", async function () {
      // Clear visible identity immediately even if remote sign-out later fails.
      resetPortalState("signout");
      statusBanner();
      renderAuthBox();
      try { await A.signOut(); } catch (e) {}
      refreshAll();
    });
  }

  function renderSelector() {
    var sel = el("acadSelector");
    if (!sel) return;
    if (!S.memberships.length) {
      sel.innerHTML = '<span class="muted">' + esc(tr("noMember")) + "</span>";
      return;
    }
    sel.innerHTML = '<label class="muted">🏫 الأكاديمية: </label><select id="acadSel">' +
      S.memberships.map(function (m) {
        return '<option value="' + esc(m.academy_id) + '"' + (m.academy_id === S.currentAcademy ? " selected" : "") + ">" +
          esc(m.academy_id.slice(0, 8)) + "… — " + esc(roleLabel(m.role)) + "</option>";
      }).join("") + "</select> " +
      (S.role ? '<span class="cmd-pill">' + esc(roleLabel(S.role)) + "</span>" : "");
    var s = el("acadSel");
    if (s) s.addEventListener("change", function () {
      S.currentAcademy = s.value;
      S.role = null;
      S.memberships.forEach(function (m) { if (m.academy_id === S.currentAcademy) S.role = m.role; });
      refreshAll();
    });
  }

  function denied(e) {
    if (!e) return "denied";
    if (e.code === "TARGET_DISABLED") return tr("targetDisabled");
    if (e.code === "INCONSISTENT_TARGET") return tr("acadInconsistent");
    if (e.code === "SIGNIN_REQUIRED") return tr("acadSigninRequired");
    if (e.code === "SETUP_REQUIRED") return tr("setupMissing");
    if (e.code === "NOT_AUTH") return tr("signin");
    if (e.code === "DENIED") return tr("acadDenied");
    if (e.code === "VALIDATION") return (e.error || "denied");
    try {
      var m = String(e.error || "");
      if (/invalid.*credential|invalid login|wrong.*password|user.*not.*found|email.*not.*confirmed/i.test(m)) {
        return tr("acadInvalidCredentials");
      }
      if (/permission|not.*author|denied|forbidden|rls|policy/i.test(m)) {
        return tr("acadDenied");
      }
    } catch (x) {}
    return e.error || "denied";
  }

  function isAcademyBlocked(r) {
    try {
      return !!r && (r.code === "TARGET_DISABLED" || r.code === "INCONSISTENT_TARGET" || r.code === "SIGNIN_REQUIRED");
    }
    catch (e) { return false; }
  }

  async function renderOverview() {
    var box = el("acadOverviewBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.currentAcademy) { box.innerHTML = '<div class="muted">' + esc(tr("noMember")) + "</div>"; return; }
    box.innerHTML = '<div class="muted">…</div>';
    var cls = await C.listClasses(S.currentAcademy, { page: 1, size: 5 });
    var mem = await C.listMembers(S.currentAcademy, { page: 1, size: 5 });
    if (isAcademyBlocked(cls) || isAcademyBlocked(mem)) {
      box.innerHTML = '<div class="muted">🚫 ' + esc(denied(cls.code ? cls : mem)) + "</div>"; return;
    }
    if ((cls.code === "SETUP_REQUIRED") || (mem.code === "SETUP_REQUIRED")) {
      box.innerHTML = '<div class="muted">' + esc(tr("setupMissing")) + "</div>"; return;
    }
    if (cls.error && mem.error) { box.innerHTML = '<div class="muted">⛔ ' + esc(denied(cls)) + "</div>"; return; }
    box.innerHTML =
      '<div class="cmd-pstats">' +
      '<div class="cmd-pstat"><div class="pi">🏫</div><b>' + esc(String(cls.count || (cls.data || []).length)) + '</b><span>' + esc(tr("classes")) + "</span></div>" +
      '<div class="cmd-pstat"><div class="pi">👥</div><b>' + esc(String(mem.count || (mem.data || []).length)) + '</b><span>' + esc(tr("teachers")) + "</span></div>" +
      '<div class="cmd-pstat"><div class="pi">🎓</div><b>' + esc(S.role ? roleLabel(S.role) : "—") + "</b><span>دورك</span></div>" +
      "</div>" +
      '<div class="muted">التقارير التفصيلية في أقسام الفصول والتسجيل ولوحة المعلم. لا تُعرض هنا أي درجات مُخترعة — فقط بيانات التقدم الحقيقية.</div>';
  }

  async function renderSettings() {
    var box = el("acadSettingsBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.currentAcademy) { box.innerHTML = '<div class="muted">' + esc(tr("noMember")) + "</div>"; return; }
    if (!C.canManageAcademy({ userId: S.user && S.user.id, isPlatformOwner: false, memberships: S.memberships }, S.currentAcademy)) {
      // Platform-owner check needs server truth; show read-only + honest note.
      box.innerHTML = '<div class="muted">⛔ الإعدادات للقراءة فقط لدورك الحالي (' + esc(S.role || "—") + "). التعديل لمديري الأكاديمية فقط.</div>";
      return;
    }
    box.innerHTML =
      '<div class="form-group"><label>اسم الأكاديمية (2..120)</label><input id="acadName" class="full-input" maxlength="120"></div>' +
      '<div class="form-group"><label>الوصف</label><input id="acadDesc" class="full-input" maxlength="2000"></div>' +
      '<div class="form-group"><label>اللون (#RRGGBB)</label><input id="acadColor" class="full-input" dir="ltr" placeholder="#0B1020"></div>' +
      '<div class="row-flex"><button class="btn btn-primary sm" id="acadSave">💾 حفظ</button>' +
      '<button class="btn btn-ghost sm" id="acadArchive">🗄️ أرشفة</button>' +
      '<button class="btn btn-ghost sm" id="acadUnarchive">📂 إلغاء الأرشفة</button></div>' +
      '<div class="muted" id="acadSettingsMsg"></div>';
    var save = el("acadSave");
    if (save) save.addEventListener("click", async function () {
      var msg = el("acadSettingsMsg");
      var r = await C.updateAcademy(S.currentAcademy, {
        name: el("acadName").value, description: el("acadDesc").value, primary_color: el("acadColor").value || undefined
      });
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ تم الحفظ";
      if (!r.error) { try { await C.logAudit(S.currentAcademy, "academy.update", "settings", S.currentAcademy, {}); } catch (e) {} }
    });
    var arc = el("acadArchive");
    if (arc) arc.addEventListener("click", async function () {
      var r = await C.updateAcademy(S.currentAcademy, { archived: true });
      var msg = el("acadSettingsMsg");
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ تمت الأرشفة (تُخفى من القوائم)";
    });
    var un = el("acadUnarchive");
    if (un) un.addEventListener("click", async function () {
      var r = await C.updateAcademy(S.currentAcademy, { archived: false });
      var msg = el("acadSettingsMsg");
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ أُلغيت الأرشفة";
    });
  }

  async function renderTeachers() {
    var box = el("acadTeachersBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.currentAcademy) { box.innerHTML = '<div class="muted">' + esc(tr("noMember")) + "</div>"; return; }
    var st = S.teachers;
    box.innerHTML =
      '<div class="row-flex"><input id="acadTSearch" class="full-input" style="flex:1" placeholder="بحث بـ User ID…" dir="ltr">' +
      '<button class="btn btn-ghost sm" id="acadTPrev">‹</button><span class="muted" id="acadTPage"></span>' +
      '<button class="btn btn-ghost sm" id="acadTNext">›</button></div>' +
      '<div id="acadTList"><div class="muted">…</div></div>' +
      '<div class="panel glass"><h4>➕ إضافة عضو موجود (User ID + دور)</h4>' +
      '<div class="muted">يُضاف فقط مستخدم مسجّل حاليًا (UUID). لا تُرسَل دعوات بريدية تلقائيًا في المرحلة 1 — أرسل الـ User ID خارج التطبيق (واتساب/مقابلة) ثم أدخله هنا. لا يمكنك منح نفسك دورًا مميزًا.</div>' +
      '<div class="row-flex"><input id="acadTUid" class="full-input" dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style="flex:2">' +
      '<select id="acadTRole"><option value="student">student</option><option value="teacher">teacher</option>' +
      '<option value="academy_admin">academy_admin</option><option value="academy_owner">academy_owner</option></select>' +
      '<button class="btn btn-primary sm" id="acadTAdd">إضافة</button></div>' +
      '<div class="muted" id="acadTMsg"></div></div>';
    async function load() {
      var list = el("acadTList");
      var r = await C.listMembers(S.currentAcademy, { page: st.page, size: C.PAGE_SIZE });
      if (isAcademyBlocked(r)) { list.innerHTML = '<div class="muted">🚫 ' + esc(denied(r)) + "</div>"; return; }
      if (r.code === "SETUP_REQUIRED") { list.innerHTML = '<div class="muted">' + esc(tr("setupMissing")) + "</div>"; return; }
      if (r.error) { list.innerHTML = '<div class="muted">⛔ ' + esc(denied(r)) + "</div>"; return; }
      var rows = (r.data || []).filter(function (m) {
        if (!st.search) return true;
        return String(m.user_id).toLowerCase().indexOf(st.search.toLowerCase()) >= 0 || String(m.role).indexOf(st.search) >= 0;
      });
      if (!rows.length) { list.innerHTML = '<div class="muted">لا يوجد أعضاء بعد — أضف أول عضو أعلاه.</div>'; }
      else {
        var prof = await C.getProfiles(rows.map(function (m) { return m.user_id; }));
        var names = {};
        (prof.data || []).forEach(function (p) { names[p.id] = p.display_name || ""; });
        list.innerHTML = rows.map(function (m) {
          return '<div class="device-item"><div class="device-info"><strong dir="ltr">' + esc(m.user_id.slice(0, 8)) + '…</strong> ' +
            "<span>" + esc(names[m.user_id] || "") + "</span> " +
            '<span class="provider-badge">' + esc(roleLabel(m.role)) + "</span></div>" +
            '<div class="row-flex"><select data-role-for="' + esc(m.user_id) + '">' +
            ["student", "teacher", "academy_admin", "academy_owner"].map(function (rl) {
              return '<option value="' + rl + '"' + (m.role === rl ? " selected" : "") + ">" + rl + "</option>";
            }).join("") + "</select>" +
            '<button class="btn btn-ghost sm" data-save-member="' + esc(m.user_id) + '">حفظ الدور</button>' +
            '<button class="btn btn-red sm" data-remove-member="' + esc(m.user_id) + '">إزالة</button></div></div>';
        }).join("");
        list.querySelectorAll("[data-save-member]").forEach(function (b) {
          b.addEventListener("click", async function () {
            var uid = b.getAttribute("data-save-member");
            var sel = list.querySelector('[data-role-for="' + uid + '"]');
            var rr = await C.updateMemberRole(S.currentAcademy, uid, sel ? sel.value : "student");
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ تم تحديث الدور", rr.error ? "err" : "ok");
            if (!rr.error) { try { await C.logAudit(S.currentAcademy, "member.role", "member", uid, { role: sel.value }); } catch (e) {} load(); }
          });
        });
        list.querySelectorAll("[data-remove-member]").forEach(function (b) {
          b.addEventListener("click", async function () {
            if (!confirm("إزالة العضو من الأكاديمية؟ (يُبطل الوصول فقط — لا يُحذف الحساب ولا سجل التعلم)")) return;
            var uid = b.getAttribute("data-remove-member");
            var rr = await C.removeMember(S.currentAcademy, uid);
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ أُزيل العضو (حسابه وسجله intact)", rr.error ? "err" : "ok");
            if (!rr.error) { try { await C.logAudit(S.currentAcademy, "member.remove", "member", uid, {}); } catch (e) {} load(); }
          });
        });
      }
      var pg = el("acadTPage");
      if (pg) pg.textContent = "ص " + st.page + (r.count ? (" / " + Math.max(1, Math.ceil(r.count / C.PAGE_SIZE))) : "");
    }
    el("acadTPrev").addEventListener("click", function () { st.page = Math.max(1, st.page - 1); load(); });
    el("acadTNext").addEventListener("click", function () { st.page = st.page + 1; load(); });
    el("acadTSearch").addEventListener("input", function (e) { st.search = e.target.value.trim(); load(); });
    el("acadTAdd").addEventListener("click", async function () {
      var uid = el("acadTUid").value.trim(), role = el("acadTRole").value;
      var msg = el("acadTMsg");
      var r = await C.addMember(S.currentAcademy, uid, role);
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ تمت الإضافة";
      if (!r.error) { try { await C.logAudit(S.currentAcademy, "member.add", "member", uid, { role: role }); } catch (e) {} el("acadTUid").value = ""; load(); }
    });
    await load();
  }

  async function renderClasses() {
    var box = el("acadClassesBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.currentAcademy) { box.innerHTML = '<div class="muted">' + esc(tr("noMember")) + "</div>"; return; }
    var st = S.classes;
    box.innerHTML =
      '<div class="row-flex"><input id="acadCSearch" class="full-input" style="flex:1" placeholder="بحث باسم الفصل…">' +
      '<button class="btn btn-ghost sm" id="acadCPrev">‹</button><span class="muted" id="acadCPage"></span>' +
      '<button class="btn btn-ghost sm" id="acadCNext">›</button></div>' +
      '<div id="acadCList"><div class="muted">…</div></div>' +
      '<div class="panel glass"><h4>➕ فصل جديد</h4>' +
      '<div class="row-flex"><input id="acadCName" class="full-input" style="flex:2" placeholder="اسم الفصل (2..120)" maxlength="120">' +
      '<select id="acadCLevel"><option value="">—</option><option>A1</option><option>A2</option><option>B1</option><option>B2</option></select>' +
      '<button class="btn btn-primary sm" id="acadCCreate">إنشاء</button></div>' +
      '<div class="muted" id="acadCMsg"></div></div>';
    async function load() {
      var list = el("acadCList");
      var r = await C.listClasses(S.currentAcademy, { page: st.page, size: C.PAGE_SIZE, search: st.search });
      if (isAcademyBlocked(r)) { list.innerHTML = '<div class="muted">🚫 ' + esc(denied(r)) + "</div>"; return; }
      if (r.code === "SETUP_REQUIRED") { list.innerHTML = '<div class="muted">' + esc(tr("setupMissing")) + "</div>"; return; }
      if (r.error) { list.innerHTML = '<div class="muted">⛔ ' + esc(denied(r)) + "</div>"; return; }
      var rows = r.data || [];
      if (!rows.length) { list.innerHTML = '<div class="muted">لا توجد فصول بعد — أنشئ أول فصل أدناه.</div>'; }
      else {
        list.innerHTML = rows.map(function (c) {
          return '<div class="device-item"><div class="device-info"><strong>' + esc(c.name) + "</strong> " +
            '<span class="provider-badge">' + esc(c.level || "—") + "</span> " +
            (c.archived_at ? '<span class="provider-badge">🗄️ archived</span>' : "") + "</div>" +
            '<div class="row-flex"><input data-cname="' + esc(c.id) + '" class="full-input" value="' + esc(c.name) + '" maxlength="120" style="flex:2">' +
            '<select data-clevel="' + esc(c.id) + '"><option value="">—</option>' +
            ["A1", "A2", "B1", "B2"].map(function (L) {
              return '<option' + (c.level === L ? " selected" : "") + ">" + L + "</option>";
            }).join("") + "</select>" +
            '<button class="btn btn-ghost sm" data-csave="' + esc(c.id) + '">حفظ</button>' +
            (c.archived_at
              ? '<button class="btn btn-ghost sm" data-cunarch="' + esc(c.id) + '">إلغاء الأرشفة</button>'
              : '<button class="btn btn-ghost sm" data-carch="' + esc(c.id) + '">أرشفة</button>') +
            '<button class="btn btn-ghost sm" data-cteacher="' + esc(c.id) + '">👥 المعلمون</button>' +
            '<button class="btn btn-ghost sm" data-cenroll="' + esc(c.id) + '">🎓 التسجيل</button></div>' +
            '<div class="muted" data-cteachers="' + esc(c.id) + '"></div></div>';
        }).join("");
        list.querySelectorAll("[data-csave]").forEach(function (b) {
          b.addEventListener("click", async function () {
            var id = b.getAttribute("data-csave");
            var nm = list.querySelector('[data-cname="' + id + '"]').value;
            var lv = list.querySelector('[data-clevel="' + id + '"]').value || null;
            var rr = await C.updateClass(id, { name: nm, level: lv });
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ تم حفظ الفصل", rr.error ? "err" : "ok");
            if (!rr.error) load();
          });
        });
        list.querySelectorAll("[data-carch]").forEach(function (b) {
          b.addEventListener("click", async function () {
            var rr = await C.updateClass(b.getAttribute("data-carch"), { archived: true });
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ أُرشف الفصل", rr.error ? "err" : "ok");
            if (!rr.error) load();
          });
        });
        list.querySelectorAll("[data-cunarch]").forEach(function (b) {
          b.addEventListener("click", async function () {
            var rr = await C.updateClass(b.getAttribute("data-cunarch"), { archived: false });
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ أُلغيت الأرشفة", rr.error ? "err" : "ok");
            if (!rr.error) load();
          });
        });
        list.querySelectorAll("[data-cteacher]").forEach(function (b) {
          b.addEventListener("click", async function () { await toggleTeachers(b.getAttribute("data-cteacher")); });
        });
        list.querySelectorAll("[data-cenroll]").forEach(function (b) {
          b.addEventListener("click", function () {
            S.enroll.classId = b.getAttribute("data-cenroll");
            S.enroll.page = 1;
            try { if (typeof showPage === "function") showPage("academy-enroll"); } catch (e) {}
            renderEnroll();
          });
        });
      }
      var pg = el("acadCPage");
      if (pg) pg.textContent = "ص " + st.page + (r.count ? (" / " + Math.max(1, Math.ceil(r.count / C.PAGE_SIZE))) : "");
    }
    async function toggleTeachers(classId) {
      var slot = document.querySelector('[data-cteachers="' + classId + '"]');
      if (!slot) return;
      if (slot.dataset.open === "1") { slot.innerHTML = ""; slot.dataset.open = ""; return; }
      slot.dataset.open = "1";
      slot.innerHTML = '<div class="muted">…</div>';
      var t = await C.listClassTeachers(classId);
      if (t.error) { slot.innerHTML = '<div class="muted">⛔ ' + esc(denied(t)) + "</div>"; return; }
      slot.innerHTML =
        '<div class="muted">المعلمون المعيّنون (' + t.data.length + '): ' +
        (t.data.map(function (x) { return '<code dir="ltr">' + esc(x.teacher_id.slice(0, 8)) + '…</code>'; }).join(" ") || "—") + "</div>" +
        '<div class="row-flex"><input data-tuid class="full-input" dir="ltr" placeholder="Teacher User ID (UUID)" style="flex:2">' +
        '<button class="btn btn-primary sm" data-tadd>تعيين</button></div><div class="muted" data-tmsg></div>' +
        '<div class="row-flex">' + t.data.map(function (x) {
          return '<button class="btn btn-red sm" data-tdel="' + esc(x.teacher_id) + '">✖ ' + esc(x.teacher_id.slice(0, 8)) + "…</button>";
        }).join("") + "</div>";
      slot.querySelector("[data-tadd]").addEventListener("click", async function () {
        var uid = slot.querySelector("[data-tuid]").value.trim();
        var rr = await C.assignTeacher(classId, uid);
        slot.querySelector("[data-tmsg]").textContent = rr.error ? ("⛔ " + denied(rr)) : "✅ تم التعيين";
        if (!rr.error) { try { await C.logAudit(S.currentAcademy, "teacher.assign", "teacher_assignment", classId, { teacher: uid }); } catch (e) {} toggleTeachers(classId); slot.dataset.open = "1"; await toggleTeachersRefresh(classId, slot); }
      });
      slot.querySelectorAll("[data-tdel]").forEach(function (b) {
        b.addEventListener("click", async function () {
          var rr = await C.unassignTeacher(classId, b.getAttribute("data-tdel"));
          toast(rr.error ? ("⛔ " + denied(rr)) : "✅ أُلغي التعيين", rr.error ? "err" : "ok");
          if (!rr.error) { slot.dataset.open = ""; toggleTeachers(classId); }
        });
      });
    }
    async function toggleTeachersRefresh(classId, slot) {
      slot.dataset.open = "";
      // reopen via the class-list button path (simple + bounded)
      var btn = document.querySelector('[data-cteacher="' + classId + '"]');
      if (btn) btn.click();
    }
    el("acadCPrev").addEventListener("click", function () { st.page = Math.max(1, st.page - 1); load(); });
    el("acadCNext").addEventListener("click", function () { st.page = st.page + 1; load(); });
    el("acadCSearch").addEventListener("input", function (e) { st.search = e.target.value.trim(); st.page = 1; load(); });
    el("acadCCreate").addEventListener("click", async function () {
      var r = await C.createClass(S.currentAcademy, { name: el("acadCName").value, level: el("acadCLevel").value || null });
      var msg = el("acadCMsg");
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ تم إنشاء الفصل";
      if (!r.error) {
        try { await C.logAudit(S.currentAcademy, "class.create", "class", r.data.id, { name: r.data.name }); } catch (e) {}
        el("acadCName").value = ""; st.page = 1; load();
      }
    });
    await load();
  }

  async function renderEnroll() {
    var box = el("acadEnrollBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.currentAcademy) { box.innerHTML = '<div class="muted">' + esc(tr("noMember")) + "</div>"; return; }
    var cls = await C.listClasses(S.currentAcademy, { page: 1, size: C.MAX_PAGE_SIZE });
    var classes = (cls.data || []).filter(function (c) { return !c.archived_at; });
    if (!S.enroll.classId && classes.length) S.enroll.classId = classes[0].id;
    box.innerHTML =
      '<div class="row-flex"><label class="muted">الفصل:</label><select id="acadEClass">' +
      classes.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === S.enroll.classId ? " selected" : "") + ">" + esc(c.name) + " (" + esc(c.level || "—") + ")</option>";
      }).join("") + "</select>" +
      '<button class="btn btn-ghost sm" id="acadEPrev">‹</button><span class="muted" id="acadEPage"></span>' +
      '<button class="btn btn-ghost sm" id="acadENext">›</button></div>' +
      '<div id="acadEList"><div class="muted">…</div></div>' +
      '<div class="panel glass"><h4>➕ تسجيل طالب موجود</h4>' +
      '<div class="muted">أدخل User ID لطالب مسجّل وعضو في الأكاديمية. الإزالة تُبطل وصول الفصل فقط — الحساب وسجل التعلم يبقيان.</div>' +
      '<div class="row-flex"><input id="acadEUid" class="full-input" dir="ltr" placeholder="Student User ID (UUID)" style="flex:2">' +
      '<button class="btn btn-primary sm" id="acadEAdd">تسجيل</button></div><div class="muted" id="acadEMsg"></div></div>';
    var sel = el("acadEClass");
    if (sel) sel.addEventListener("change", function () { S.enroll.classId = sel.value; S.enroll.page = 1; load(); });
    el("acadEPrev").addEventListener("click", function () { S.enroll.page = Math.max(1, S.enroll.page - 1); load(); });
    el("acadENext").addEventListener("click", function () { S.enroll.page = S.enroll.page + 1; load(); });
    el("acadEAdd").addEventListener("click", async function () {
      if (!S.enroll.classId) return;
      var r = await C.enrollStudent(S.enroll.classId, el("acadEUid").value.trim());
      var msg = el("acadEMsg");
      if (msg) msg.textContent = r.error ? ("⛔ " + denied(r)) : "✅ تم التسجيل";
      if (!r.error) {
        try { await C.logAudit(S.currentAcademy, "enrollment.add", "enrollment", S.enroll.classId, { student: el("acadEUid").value.trim() }); } catch (e) {}
        el("acadEUid").value = ""; load();
      }
    });
    async function load() {
      var list = el("acadEList");
      if (!S.enroll.classId) { list.innerHTML = '<div class="muted">لا يوجد فصل نشط.</div>'; return; }
      var r = await C.listEnrollments(S.enroll.classId, { page: S.enroll.page, size: C.PAGE_SIZE });
      if (isAcademyBlocked(r)) { list.innerHTML = '<div class="muted">🚫 ' + esc(denied(r)) + "</div>"; return; }
      if (r.code === "SETUP_REQUIRED") { list.innerHTML = '<div class="muted">' + esc(tr("setupMissing")) + "</div>"; return; }
      if (r.error) { list.innerHTML = '<div class="muted">⛔ ' + esc(denied(r)) + "</div>"; return; }
      var rows = r.data || [];
      if (!rows.length) { list.innerHTML = '<div class="muted">لا يوجد طلاب مسجلون بعد — سجّل أول طالب أدناه.</div>'; }
      else {
        var prof = await C.getProfiles(rows.map(function (e) { return e.student_id; }));
        var names = {};
        (prof.data || []).forEach(function (p) { names[p.id] = p.display_name || ""; });
        list.innerHTML = rows.map(function (e) {
          return '<div class="device-item"><div class="device-info"><strong dir="ltr">' + esc(e.student_id.slice(0, 8)) + '…</strong> ' +
            "<span>" + esc(names[e.student_id] || "") + "</span></div>" +
            '<button class="btn btn-red sm" data-e-del="' + esc(e.student_id) + '">إزالة من الفصل</button></div>';
        }).join("");
        list.querySelectorAll("[data-e-del]").forEach(function (b) {
          b.addEventListener("click", async function () {
            if (!confirm("إزالة الطالب من الفصل؟ (حسابه وسجله يبقيان)")) return;
            var rr = await C.removeEnrollment(S.enroll.classId, b.getAttribute("data-e-del"));
            toast(rr.error ? ("⛔ " + denied(rr)) : "✅ أُزيل من الفصل", rr.error ? "err" : "ok");
            if (!rr.error) load();
          });
        });
      }
      var pg = el("acadEPage");
      if (pg) pg.textContent = "ص " + S.enroll.page + (r.count ? (" / " + Math.max(1, Math.ceil(r.count / C.PAGE_SIZE))) : "");
    }
    await load();
  }

  async function renderTeacherDash() {
    var box = el("acadTeacherBody");
    if (!box) return;
    var C = window.AcademyCore;
    if (!S.user) { box.innerHTML = '<div class="muted">' + esc(tr("signin")) + "</div>"; return; }
    var mine = await C.myTeachingClasses({ page: 1, size: C.MAX_PAGE_SIZE });
    if (isAcademyBlocked(mine)) { box.innerHTML = '<div class="muted">🚫 ' + esc(denied(mine)) + "</div>"; return; }
    if (mine.code === "SETUP_REQUIRED") { box.innerHTML = '<div class="muted">' + esc(tr("setupMissing")) + "</div>"; return; }
    if (mine.error) { box.innerHTML = '<div class="muted">⛔ ' + esc(denied(mine)) + "</div>"; return; }
    var classes = mine.data || [];
    // Academy managers also see academy classes here (read path stays RLS-gated).
    if (!classes.length && S.currentAcademy) {
      var all = await C.listClasses(S.currentAcademy, { page: 1, size: C.MAX_PAGE_SIZE });
      if (!all.error) classes = (all.data || []).filter(function (c) { return !c.archived_at; }).slice(0, 5);
    }
    if (!classes.length) {
      box.innerHTML = '<div class="muted">لا توجد فصول مُسندة إليك بعد. عند تعيينك من مدير الأكاديمية ستظهر فصولك هنا مع طلابها وتقدمهم.</div>';
      return;
    }
    if (!S.teacherDash.classId) S.teacherDash.classId = classes[0].id;
    box.innerHTML =
      '<div class="row-flex"><label class="muted">الفصل:</label><select id="acadTDClass">' +
      classes.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === S.teacherDash.classId ? " selected" : "") + ">" + esc(c.name) + " (" + esc(c.level || "—") + ")</option>";
      }).join("") + "</select>" +
      '<button class="btn btn-ghost sm" id="acadTDPrev">‹</button><span class="muted" id="acadTDPage"></span>' +
      '<button class="btn btn-ghost sm" id="acadTDNext">›</button></div>' +
      '<div id="acadTDList"><div class="muted">…</div></div>' +
      '<div id="acadTDDetail"></div>' +
      '<div class="muted">تُحسب الملخصات فقط من سجلات التقدم الحقيقية (user_progress.state). الغياب = لا بيانات (يُعرض صراحة)، ولا تُخترع درجات أو حضور.</div>';
    el("acadTDClass").addEventListener("change", function (e) { S.teacherDash.classId = e.target.value; S.teacherDash.page = 1; S.teacherDash.detail = null; load(); });
    el("acadTDPrev").addEventListener("click", function () { S.teacherDash.page = Math.max(1, S.teacherDash.page - 1); load(); });
    el("acadTDNext").addEventListener("click", function () { S.teacherDash.page = S.teacherDash.page + 1; load(); });
    async function load() {
      var list = el("acadTDList"), det = el("acadTDDetail");
      if (det) det.innerHTML = "";
      var r = await C.listEnrollments(S.teacherDash.classId, { page: S.teacherDash.page, size: 10 });
      if (r.error) { list.innerHTML = '<div class="muted">⛔ ' + esc(denied(r)) + "</div>"; return; }
      var rows = r.data || [];
      if (!rows.length) { list.innerHTML = '<div class="muted">لا يوجد طلاب في هذا الفصل بعد.</div>'; return; }
      var prof = await C.getProfiles(rows.map(function (e) { return e.student_id; }));
      var names = {};
      (prof.data || []).forEach(function (p) { names[p.id] = p.display_name || ""; });
      // Bounded: fetch progress ONLY for the visible page (≤10 students).
      var cards = [];
      for (var i = 0; i < rows.length; i++) {
        var sid = rows[i].student_id;
        var pr = await C.getStudentProgress(sid);
        var sum = pr.summary || C.aggregateProgress(null);
        cards.push({ sid: sid, name: names[sid] || "", sum: sum, denied: !!pr.error, err: pr.error || null });
      }
      list.innerHTML = cards.map(function (c) {
        if (c.denied) {
          return '<div class="device-item"><div class="device-info"><strong dir="ltr">' + esc(c.sid.slice(0, 8)) + '…</strong> ' +
            "<span>" + esc(c.name) + "</span></div><div class=\"muted\">⛔ " + esc((c.err && c.err.error) || "not authorized") + "</div></div>";
        }
        var s = c.sum;
        var body = s.hasData
          ? ("✅ محاولات: <b>" + s.totalAnswered + "</b> • دقة: <b>" + s.accuracy + "٪</b> • أخطاء مفتوحة: <b>" + s.mistakesOpen + "</b> • مراجعة مستحقة: <b>" + s.dueReview + "</b>" +
            (s.weekly && s.weekly.hasData ? (" • آخر ٧ أيام: <b>" + s.weekly.curAns + "</b> (" + s.weekly.curPct + "٪)") : ""))
          : "📭 لا توجد بيانات تقدم بعد لهذا الطالب.";
        return '<div class="device-item"><div class="device-info"><strong dir="ltr">' + esc(c.sid.slice(0, 8)) + '…</strong> ' +
          "<span>" + esc(c.name) + "</span></div><div class=\"muted\">" + body + "</div>" +
          '<button class="btn btn-ghost sm" data-td-detail="' + esc(c.sid) + '">عرض التفاصيل</button></div>';
      }).join("");
      list.querySelectorAll("[data-td-detail]").forEach(function (b) {
        b.addEventListener("click", async function () { await showDetail(b.getAttribute("data-td-detail")); });
      });
      var pg = el("acadTDPage");
      if (pg) pg.textContent = "ص " + S.teacherDash.page + (r.count ? (" / " + Math.max(1, Math.ceil(r.count / 10))) : "");
      if (S.teacherDash.detail) await showDetail(S.teacherDash.detail, true);
    }
    async function showDetail(sid, keep) {
      S.teacherDash.detail = sid;
      var det = el("acadTDDetail");
      if (!det) return;
      det.innerHTML = '<div class="muted">…</div>';
      var pr = await C.getStudentProgress(sid);
      if (pr.error) { det.innerHTML = '<div class="muted">⛔ ' + esc(denied(pr)) + "</div>"; return; }
      var s = pr.summary;
      var st = pr.data && pr.data.state;
      var ev = (st && Array.isArray(st.events) ? st.events : []).slice(-8).reverse();
      det.innerHTML = '<div class="panel glass"><h4>🎓 <code dir="ltr">' + esc(sid.slice(0, 13)) + '…</code></h4>' +
        (s.hasData
          ? ("<div>محاولات: <b>" + s.totalAnswered + "</b> • صحيحة: <b>" + s.totalCorrect + "</b> • دقة: <b>" + s.accuracy + "٪</b></div>" +
            "<div>آخر نشاط: " + esc(s.lastActivity || "—") + "</div>" +
            "<div>آخر محاولات (" + ev.length + "):</div>" +
            (ev.length ? ("<ul>" + ev.map(function (e) {
              return "<li><code dir=\"ltr\">" + esc(e.qtype || e.sec || "?") + "</code> " + (e.ok ? "✅" : "❌") + " <span class=\"muted\">" + esc(e.ts || e.day || "") + "</span></li>";
            }).join("") + "</ul>") : '<div class="muted">لا محاولات مسجلة.</div>'))
          : '<div class="muted">📭 لا توجد بيانات تقدم بعد — يُعرض هذا صراحة بدل اختراع درجات.</div>') +
        "</div>";
      if (!keep) { try { det.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {} }
    }
    await load();
  }

  function bindNavRefresh() {
    try {
      document.querySelectorAll('.nav-item[data-page^="academy-"], .nav-item[data-page="teacher"]').forEach(function (b) {
        b.addEventListener("click", function () { setTimeout(refreshAll, 50); });
      });
    } catch (e) {}
    try {
      // Academy session changes only: dedicated Academy session drives the
      // portal (independence by design).
      if (window.AcademyAuth && typeof window.AcademyAuth.onAuthStateChange === "function") {
        window.AcademyAuth.onAuthStateChange(function (event, session) {
          try {
            if (!session || event === "SIGNED_OUT") {
              resetPortalState("auth_no_session");
              try { statusBanner(); } catch (e2) {}
              try { renderAuthBox(); } catch (e3) {}
            }
          } catch (e) {}
          setTimeout(refreshAll, 300);
        });
      }
    } catch (e) {}
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    try {
      if (!document.getElementById("acadSetupBanner")) return; // learner entry (index.html): stay inert
      bindNavRefresh();
      refreshAll();
      // Manual refresh button (honest, always available)
      var rb = el("acadRefresh");
      if (rb) rb.addEventListener("click", refreshAll);
    } catch (e) {
      try { resetPortalState("init_failed"); } catch (e2) {}
      console.warn("[AcademyPortal] init failed:", e);
    }
  });

  try {
    if (typeof window !== "undefined" && window) {
      window.__AcademyPortalTest = {
        getState: function () { return S; },
        reset: resetPortalState,
        tr: tr,
        denied: denied,
        refreshAll: refreshAll
      };
    }
  } catch (e) {}
})();
