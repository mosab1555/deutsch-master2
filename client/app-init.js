/* Deutsch Master - App Initialization
   Initializes Supabase, Auth, CloudSync, and handles auth flow
   This is the main entry point for the authentication system
*/
"use strict";

(function () {
    "use strict";

// Global unhandled rejection handler for debugging
    window.addEventListener("unhandledrejection", function(event) {
        console.warn("[App] Unhandled promise rejection:", event.reason && event.reason.message ? event.reason.message : event.reason);
        event.preventDefault();
    });

    // Check if Supabase config exists
    function checkConfig() {
        if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
            console.warn("[App] Supabase config not found. Auth features disabled.");
            console.warn("[App] Copy client/supabase-config.example.js to client/supabase-config.js and fill in your values");
            return false;
        }
        // Additional validation - ensure URL looks like a Supabase URL
        var url = window.SUPABASE_CONFIG.url;
        if (!url || typeof url !== "string" || !url.includes(".supabase.co")) {
            console.warn("[App] Invalid Supabase URL in config");
            return false;
        }
        return true;
    }

    // Load Supabase JS library dynamically
    function loadSupabaseLibrary() {
        return new Promise(function(resolve, reject) {
            if (window.supabase) {
                resolve();
                return;
            }

            var script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
            script.onload = function() { resolve(); };
            script.onerror = function() { reject(new Error("Failed to load Supabase library")); };
            document.head.appendChild(script);
        });
    }

    // Show auth page
    function showAuthPage() {
        var authPage = document.getElementById("page-auth");
        if (!authPage) {
            // Pages without an auth section (e.g. academy.html) - use the main login
            window.location.href = "index.html";
            return;
        }
        authPage.classList.add("active");
        // Hide all other pages
        document.querySelectorAll(".page:not(#page-auth)").forEach(function(p) { p.classList.remove("active"); });
        document.querySelectorAll(".nav-item").forEach(function(b) { b.classList.remove("active"); });
        // Hide sidebar (single authority: DMDrawer in script.js when present).
        if (window.DMDrawer && typeof window.DMDrawer.close === "function") { try { window.DMDrawer.close(); } catch (e) {} }
        else {
        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("sidebarOverlay")?.classList.remove("show");
        try { document.body.classList.remove("drawer-open"); } catch (e) {}
        }
        // Update auth UI
        updateAuthUI(false);
    }

    // Show main app (hide auth page)
    function showMainApp() {
        var authPage = document.getElementById("page-auth");
        if (authPage) {
            authPage.classList.remove("active");
        }
        // Show dashboard
        var dashboard = document.getElementById("page-dashboard");
        if (dashboard) {
            dashboard.classList.add("active");
        }
        document.querySelector('.nav-item[data-page="dashboard"]')?.classList.add("active");
        // Update auth UI
        updateAuthUI(true);
    }

    // Update auth UI in topbar (scope-level so every flow can reach it).
    // Single canonical external identity element: span#userEmail inside
    // #userMenu. Signed in it shows a compact account label (display name
    // when reliably available, otherwise the email); the full account email
    // is exposed via title/aria-label only, so long Gmail addresses can never
    // break the topbar layout. Signed out the element is fully cleared and
    // hidden and the guest login entry point is shown instead.
    // Stale-call safe: the rendered state is derived from the LIVE Supabase
    // user, never from the isLoggedIn argument alone, so a late/stale
    // updateAuthUI(true) after sign-out can never repaint old identity.
    function updateAuthUI(isLoggedIn) {
        var loginBtn = document.getElementById("loginBtn");
        var userMenu = document.getElementById("userMenu");
        var liveUser = null;
        try {
            liveUser = window.AuthModule?.getUser?.() || null;
        } catch (e) { liveUser = null; }
        var loggedIn = !!isLoggedIn && !!liveUser;
        var email = loggedIn ? ((liveUser && (liveUser.email || liveUser.phone)) || "") : "";
        var label = "";
        if (loggedIn && email) {
            try {
                var meta = liveUser.user_metadata || {};
                var candidate = meta.full_name || meta.display_name || meta.name || "";
                if (candidate && String(candidate).trim()) label = String(candidate).trim();
                else label = email;
            } catch (e) { label = email; }
        }
        if (loggedIn) {
            if (loginBtn) loginBtn.style.display = "none";
            if (userMenu) {
                userMenu.classList.remove("hidden");
                try { userMenu.setAttribute("data-signed-in", "true"); } catch (e) {}
            }
            /* Sidebar logout action is signed-in only (same as the old topbar
               user menu): guests must not see a logout entry. */
            try {
                var sideOut = document.getElementById("logoutBtn");
                if (sideOut) sideOut.classList.remove("hidden");
            } catch (e) {}
        } else {
            if (loginBtn) loginBtn.style.display = "";
            if (userMenu) {
                userMenu.classList.add("hidden");
                try { userMenu.setAttribute("data-signed-in", "false"); } catch (e) {}
            }
            try {
                var sideOutG = document.getElementById("logoutBtn");
                if (sideOutG) sideOutG.classList.add("hidden");
            } catch (e) {}
        }
        try {
            if (userMenu) {
                if (email) userMenu.title = email;
                else userMenu.removeAttribute("title");
                // Visible signed-in account label (textContent only, created
                // once): concise identity, full account in title/aria-label.
                var chip = document.getElementById("userEmail");
                if (loggedIn && (label || email)) {
                    if (!chip) {
                        chip = document.createElement("span");
                        chip.id = "userEmail";
                        chip.className = "user-email";
                        try { chip.setAttribute("dir", "auto"); } catch (e2) {}
                        userMenu.insertBefore(chip, userMenu.firstChild);
                    }
                    chip.textContent = label || email;
                    try { chip.title = email; } catch (e2) {}
                    try { chip.setAttribute("aria-label", email); } catch (e2) {}
                    chip.style.display = "";
                } else if (chip) {
                    // Signed out: leave zero stale identity behind.
                    chip.textContent = "";
                    try { chip.removeAttribute("title"); } catch (e2) {}
                    try { chip.removeAttribute("aria-label"); } catch (e2) {}
                    chip.style.display = "none";
                }
            }
        } catch (e) {}
    }

    // Test seam (no app logic, no new UI): exposes the existing topbar
    // renderer so headless regression tests can drive the REAL updateAuthUI
    // code with a stubbed identity. Never used by production code paths.
    try {
        window.__dmTestHooks = window.__dmTestHooks || {};
        window.__dmTestHooks.updateAuthUI = updateAuthUI;
    } catch (e) {}

    // Password-recovery completion (the reset EMAIL is sent by AuthModule.resetPassword;
    // this wires the landing side: after the user clicks the email link, Supabase
    // fires PASSWORD_RECOVERY and AuthModule.updatePassword sets the new password).
    // Dynamic strings only (no new data-i18n keys, no dict changes).
    var recoveryMode = false;
    function handlePasswordRecovery() {
        recoveryMode = true;
        showAuthPage();
        try { setAuthMode("signin"); } catch (e) {}
        showAuthMessage("أدخل كلمة المرور الجديدة في حقل كلمة المرور ثم اضغط زر التعيين.", false);
        var form = document.getElementById("emailForm");
        if (form && !document.getElementById("btnUpdatePassword")) {
            var btn = document.createElement("button");
            btn.id = "btnUpdatePassword";
            btn.type = "button";
            btn.className = "btn btn-primary btn-block";
            btn.textContent = "تعيين كلمة المرور الجديدة";
            btn.style.marginTop = "8px";
            btn.addEventListener("click", function () {
                var pw = document.getElementById("authPassword")?.value;
                if (!pw || pw.length < 6) {
                    showAuthMessage(window.t?.("weak_password") || "كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل.");
                    return;
                }
                setButtonLoading(btn, true);
                var promise = window.AuthModule?.updatePassword?.(pw);
                promise?.then(function (result) {
                    setButtonLoading(btn, false, "تعيين كلمة المرور الجديدة");
                    if (result?.error) {
                        showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                    } else {
                        recoveryMode = false;
                        showAuthMessage("تم تحديث كلمة المرور بنجاح ✓", false);
                        var pwInput = document.getElementById("authPassword");
                        if (pwInput) pwInput.value = "";
                        showMainApp();
                    }
                });
            });
            form.appendChild(btn);
        }
    }

    // Show auth message (status region per visible pane)
    var authMsgTimer = null;
    function showAuthMessage(message, isError, targetId) {
        var el = document.getElementById(targetId || (
            document.getElementById("authPaneRecovery") &&
            !document.getElementById("authPaneRecovery").classList.contains("hidden")
        ) ? "recoveryMessage" : "authMessage");
        if (!el) return;
        if (authMsgTimer) { try { clearTimeout(authMsgTimer); } catch (e) {} authMsgTimer = null; }
        el.textContent = message;
        el.className = "auth-message " + (!message ? "" : (isError ? "error" : "success"));
        try { el.setAttribute("role", isError ? "alert" : "status"); } catch (e) {}
        if (message) {
            authMsgTimer = setTimeout(function() {
                el.textContent = ""; el.className = "auth-message";
                try { el.setAttribute("role", "status"); } catch (e) {}
            }, 8000);
        }
    }

    // Set loading state on button
    function setButtonLoading(btn, loading, originalText) {
        if (!btn) return;
            if (loading) {
                btn.disabled = true;
                btn.dataset.busy = "1";
                try { btn.classList.add("is-loading"); btn.setAttribute("aria-busy", "true"); } catch (e) {}
                btn.dataset.originalText = btn.textContent;
            btn.textContent = window.t?.("loading") || "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...";
            } else {
                btn.disabled = false;
                try { delete btn.dataset.busy; } catch (e) {}
                try { btn.classList.remove("is-loading"); btn.removeAttribute("aria-busy"); } catch (e) {}
                btn.textContent = btn.dataset.originalText || originalText || "";
            }
    }

    function isBusy(btn) {
        try { return !!btn && (btn.dataset.busy === "1" || btn.disabled); } catch (e) { return false; }
    }

    function isValidEmail(v) {
        return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
    }

    // Per-field validation feedback (beside the field, not color-alone).
    function setFieldError(inputId, errorId, message) {
        var input = document.getElementById(inputId);
        var err = document.getElementById(errorId);
        if (err) {
            err.textContent = message || "";
            err.classList.toggle("hidden", !message);
        }
        if (input) {
            try {
                if (message) input.setAttribute("aria-invalid", "true");
                else input.removeAttribute("aria-invalid");
            } catch (e) {}
        }
    }

    // Auth view modes: "signin" | "signup" | "recovery". Tabs switch between
    // sign-in and registration (same inputs, same validation and handlers);
    // recovery is a dedicated pane reusing the same Supabase reset flow.
    var authMode = "signin";
    function applyModeTexts() {
        var title = document.getElementById("authTitle");
        var sub = document.getElementById("authSub");
        var t = window.t || (function (k) { return k; });
        if (authMode === "signup") {
            if (title) title.textContent = t("auth_signup_title");
            if (sub) sub.textContent = t("auth_signup_sub");
        } else {
            if (title) title.textContent = t("auth_welcome_title");
            if (sub) sub.textContent = t("auth_continue_hint");
        }
        refreshPwToggleLabel();
    }
    function setAuthMode(mode) {
        if (mode !== "signin" && mode !== "signup" && mode !== "recovery") return;
        authMode = mode;
        var card = document.getElementById("authCard");
        var main = document.getElementById("authPaneMain");
        var rec = document.getElementById("authPaneRecovery");
        var tabs = document.querySelector("#page-auth .auth-tabs");
        var btnSignIn = document.getElementById("btnSignIn");
        var btnCreate = document.getElementById("btnCreateAccount");
        var pwInput = document.getElementById("authPassword");
        if (card) { try { card.setAttribute("data-auth-mode", mode); } catch (e) {} }
        if (main) main.classList.toggle("hidden", mode === "recovery");
        if (rec) rec.classList.toggle("hidden", mode !== "recovery");
        if (tabs) tabs.style.display = mode === "recovery" ? "none" : "";
        var tabIn = document.getElementById("tabSignIn");
        var tabUp = document.getElementById("tabSignUp");
        var inUp = mode === "signup";
        if (tabIn) { tabIn.classList.toggle("is-active", !inUp && mode !== "recovery"); tabIn.setAttribute("aria-selected", (!inUp) ? "true" : "false"); }
        if (tabUp) { tabUp.classList.toggle("is-active", inUp); tabUp.setAttribute("aria-selected", inUp ? "true" : "false"); }
        if (btnSignIn) btnSignIn.classList.toggle("hidden", inUp);
        if (btnCreate) btnCreate.classList.toggle("hidden", !inUp);
        if (pwInput) {
            try { pwInput.setAttribute("autocomplete", inUp ? "new-password" : "current-password"); } catch (e) {}
        }
        setFieldError("authEmail", "emailError", "");
        setFieldError("authPassword", "passwordError", "");
        setFieldError("recoveryEmail", "recoveryEmailError", "");
        applyModeTexts();
        try {
            var h = mode === "recovery"
                ? (rec ? rec.querySelector(".auth-title") : null)
                : (main ? main.querySelector(".auth-title") : null);
            if (h) { if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
        } catch (e) {}
    }

    function refreshPwToggleLabel() {
        var tog = document.getElementById("pwToggle");
        var pw = document.getElementById("authPassword");
        if (!tog || !pw) return;
        var t = window.t || (function (k) { return k; });
        var hidden = pw.type === "password";
        var label = hidden ? t("show_password") : t("hide_password");
        try {
            tog.setAttribute("aria-label", label);
            tog.setAttribute("title", label);
            tog.setAttribute("aria-pressed", hidden ? "false" : "true");
        } catch (e) {}
    }

    // Wire the premium auth views: tabs, password toggle, phone toggle,
    // recovery form. All AuthModule calls stay identical (UI-only wiring).
    function initAuthViews() {
        document.getElementById("tabSignIn")?.addEventListener("click", function() { setAuthMode("signin"); });
        document.getElementById("tabSignUp")?.addEventListener("click", function() { setAuthMode("signup"); });
        document.getElementById("btnBackToSignIn")?.addEventListener("click", function() { setAuthMode("signin"); });

        document.getElementById("pwToggle")?.addEventListener("click", function() {
            var pw = document.getElementById("authPassword");
            var tog = document.getElementById("pwToggle");
            if (!pw || !tog) return;
            try { pw.type = pw.type === "password" ? "text" : "password"; } catch (e) { return; }
            refreshPwToggleLabel();
            try { pw.focus({ preventScroll: true }); } catch (e3) {}
        });
        refreshPwToggleLabel();

        document.getElementById("btnPhoneToggle")?.addEventListener("click", function() {
            var sec = document.getElementById("phoneSection");
            var tog = document.getElementById("btnPhoneToggle");
            if (!sec || !tog) return;
            var open = sec.classList.contains("hidden");
            sec.classList.toggle("hidden", !open);
            try { tog.setAttribute("aria-expanded", open ? "true" : "false"); } catch (e) {}
            if (open) {
                document.getElementById("otpForm")?.classList.add("hidden");
                document.getElementById("phoneForm")?.classList.remove("hidden");
                try { document.getElementById("authPhone")?.focus({ preventScroll: true }); } catch (e2) {}
            }
        });

        // Recovery form: same Supabase resetPassword flow + redirect config.
        document.getElementById("recoveryForm")?.addEventListener("submit", function(e) {
            e.preventDefault();
            var email = document.getElementById("recoveryEmail")?.value?.trim();
            var btn = document.getElementById("btnSendRecovery");
            if (!email) {
                setFieldError("recoveryEmail", "recoveryEmailError", window.t?.("enter_email_first") || "Enter your email first");
                return;
            }
            if (!isValidEmail(email)) {
                setFieldError("recoveryEmail", "recoveryEmailError", window.t?.("auth_email_invalid") || "Invalid email format");
                return;
            }
            setFieldError("recoveryEmail", "recoveryEmailError", "");
            if (!btn || isBusy(btn)) return;
            setButtonLoading(btn, true);
            var promise = window.AuthModule?.resetPassword?.(email);
            if (!promise || typeof promise.then !== "function") { setButtonLoading(btn, false, window.t?.("auth_recovery_send") || "Send"); return; }
            promise.then(function(result) {
                setButtonLoading(btn, false, window.t?.("auth_recovery_send") || "Send");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error, true, "recoveryMessage");
                } else {
                    showAuthMessage(window.t?.("reset_email_sent") || "Reset link sent", false, "recoveryMessage");
                    var inp = document.getElementById("recoveryEmail");
                    if (inp) { try { inp.value = ""; } catch (e2) {} }
                }
            });
        });

        // Clear per-field errors while typing (keeps aria-invalid accurate).
        ["authEmail|emailError", "authPassword|passwordError", "recoveryEmail|recoveryEmailError"].forEach(function(pair) {
            var parts = pair.split("|");
            var inp = document.getElementById(parts[0]);
            if (inp && !inp._authClearWired) {
                inp._authClearWired = true;
                inp.addEventListener("input", function() { setFieldError(parts[0], parts[1], ""); });
            }
        });

        // Keep dynamic auth strings (mode title/subtitle, pw toggle label)
        // correct across language switches. Same wrap pattern as showPage.
        try {
            if (typeof window.applyLang === "function" && !window.applyLang.__authWrapped) {
                var _origApplyLang = window.applyLang;
                window.applyLang = function() {
                    var out = _origApplyLang.apply(this, arguments);
                    try { applyModeTexts(); } catch (e) {}
                    return out;
                };
                window.applyLang.__authWrapped = true;
            }
        } catch (e) {}
        applyModeTexts();
    }

    // Initialize auth UI handlers
    function initAuthUI() {
        // Google Sign In
        document.getElementById("btnGoogle")?.addEventListener("click", function() {
            var btn = document.getElementById("btnGoogle");
            if (isBusy(btn)) return;
            setButtonLoading(btn, true);
            var promise = window.AuthModule?.signInWithGoogle?.();
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("continue_with_google") || "\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0639 Google");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                }
            });
        });

        // Facebook Sign In
        document.getElementById("btnFacebook")?.addEventListener("click", function() {
            var btn = document.getElementById("btnFacebook");
            if (isBusy(btn)) return;
            setButtonLoading(btn, true);
            var promise = window.AuthModule?.signInWithFacebook?.();
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("continue_with_facebook") || "\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0639 Facebook");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                }
            });
        });

        // Email Sign In
        document.getElementById("emailForm")?.addEventListener("submit", function(e) {
            e.preventDefault();
            if (authMode === "recovery") return;
            if (authMode === "signup") { try { document.getElementById("btnCreateAccount")?.click(); } catch (e2) {} return; }
            var email = document.getElementById("authEmail")?.value?.trim();
            var password = document.getElementById("authPassword")?.value;
            var btn = document.getElementById("btnSignIn");

            if (!isValidEmail(email)) {
                setFieldError("authEmail", "emailError", window.t?.("auth_email_invalid") || "Invalid email");
                return;
            }
            if (!password) {
                setFieldError("authPassword", "passwordError", window.t?.("enter_email_password") || "Enter password");
                return;
            }
            setFieldError("authEmail", "emailError", "");
            setFieldError("authPassword", "passwordError", "");
            if (!btn || isBusy(btn)) return;

            setButtonLoading(btn, true);
            var promise = window.AuthModule?.signInWithEmail?.(email, password);
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("sign_in") || "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                } else if (result?.data?.user) {
                    showAuthMessage(window.t?.("sign_in_success") || "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u2713", false);
                }
            });
        });

        // Create Account
        document.getElementById("btnCreateAccount")?.addEventListener("click", function() {
            var email = document.getElementById("authEmail")?.value?.trim();
            var password = document.getElementById("authPassword")?.value;
            var btn = document.getElementById("btnCreateAccount");
            if (isBusy(btn)) return;

            if (!email || !password) {
                showAuthMessage(window.t?.("enter_email_password") || "\u0623\u062F\u062E\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631");
                return;
            }

            if (password.length < 6) {
                showAuthMessage(window.t?.("weak_password") || "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0636\u0639\u064A\u0641\u0629 \u062C\u062F\u0627\u064B\u0627. \u0627\u0633\u062A\u062E\u062F\u0645 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.");
                return;
            }

            setButtonLoading(btn, true);
            var name = email.split("@")[0];
            var promise = window.AuthModule?.signUpWithEmail?.(email, password, name);
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("create_account") || "\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                } else if (result?.data?.user) {
                    showAuthMessage(window.t?.("account_created") || "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D \u2713", false);
                }
            });
        });

        // Forgot password: open the dedicated recovery pane (same reset flow).
        document.getElementById("btnForgotPassword")?.addEventListener("click", function() {
            setAuthMode("recovery");
            try {
                var cur = document.getElementById("authEmail")?.value || "";
                var rec = document.getElementById("recoveryEmail");
                if (rec && !rec.value && cur) rec.value = cur;
                if (rec) rec.focus({ preventScroll: true });
            } catch (e) {}
        });

        // Send OTP
        document.getElementById("btnSendOTP")?.addEventListener("click", function() {
            var phone = document.getElementById("authPhone")?.value?.trim();
            var btn = document.getElementById("btnSendOTP");
            if (isBusy(btn)) return;

            if (!phone) {
                showAuthMessage(window.t?.("enter_phone") || "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641");
                return;
            }

            setButtonLoading(btn, true);
            var promise = window.AuthModule?.sendPhoneOTP?.(phone);
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("send_otp") || "\u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                } else {
                    // Switch to OTP form
                    document.getElementById("phoneForm")?.classList.add("hidden");
                    document.getElementById("otpForm")?.classList.remove("hidden");
                    showAuthMessage(window.t?.("otp_sent") || "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0625\u0644\u0649 \u0647\u0627\u062A\u0641\u0643", false);
                }
            });
        });

        // Verify OTP
        document.getElementById("btnVerifyOTP")?.addEventListener("click", function() {
            var phone = document.getElementById("authPhone")?.value?.trim();
            var token = document.getElementById("authOTP")?.value?.trim();
            var btn = document.getElementById("btnVerifyOTP");
            if (isBusy(btn)) return;

            if (!token || token.length !== 6) {
                showAuthMessage(window.t?.("enter_otp") || "\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645");
                return;
            }

            setButtonLoading(btn, true);
            var promise = window.AuthModule?.verifyPhoneOTP?.(phone, token);
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("verify_otp") || "\u0627\u0644\u062A\u062D\u0642\u0642");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                } else if (result?.data?.user) {
                    showAuthMessage(window.t?.("verified_success") || "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0646\u062C\u0627\u062D \u2713", false);
                }
            });
        });

        // Back to phone form
        document.getElementById("btnBackToPhone")?.addEventListener("click", function() {
            document.getElementById("otpForm")?.classList.add("hidden");
            document.getElementById("phoneForm")?.classList.remove("hidden");
            var otpInput = document.getElementById("authOTP");
            if (otpInput) otpInput.value = "";
        });

        // Premium auth views (tabs, password toggle, phone toggle, recovery).
        // Guarded: auth forms exist on index.html only.
        try { initAuthViews(); } catch (e) { console.warn("[App] Auth views init failed:", e); }

        // Topbar login button
        document.getElementById("loginBtn")?.addEventListener("click", function() {
            showAuthPage();
        });

        // Sidebar logout action (single handler, bound by id; the sidebar
        // account entry is the existing data-page="profile" nav item).
        // Closes the sidebar so the resulting guest UI is fully visible.
        document.getElementById("logoutBtn")?.addEventListener("click", function() {
            // Single authority: DMDrawer in script.js when present.
            if (window.DMDrawer && typeof window.DMDrawer.close === "function") { try { window.DMDrawer.close(); } catch (e) {} }
            else {
            try { document.getElementById("sidebar")?.classList.remove("open"); } catch (e) {}
            try { document.getElementById("sidebarOverlay")?.classList.remove("show"); } catch (e) {}
            try { document.body.classList.remove("drawer-open"); } catch (e) {}
            }
            if (window.AuthModule && typeof window.AuthModule.signOut === "function") {
                var p = null;
                try { p = window.AuthModule.signOut(); } catch (e) {
                    try { window.toast?.("تعذر تسجيل الخروج. حاول مرة أخرى.", "err"); } catch (e2) {}
                    return;
                }
                if (p && typeof p.then === "function") {
                    p.then(function (res) {
                        if (res && res.error) {
                            try { window.toast?.(window.AuthModule?.translateError?.({ message: res.error }) || "تعذر تسجيل الخروج. حاول مرة أخرى.", "err"); } catch (e) {}
                        }
                    });
                }
            }
        });
    }

    // Initialize profile page when shown
    function initProfilePage() {
        if (window.ProfileModule?.initProfilePage) {
            window.ProfileModule.initProfilePage();
        }
    }

    // Main initialization
    async function initializeApp() {
        console.log("[App] Initializing Deutsch Master with Auth & Sync...");

        // Test seam (same precedent as updateAuthUI): exposes the REAL login /
        // logout transition handlers so headless regression tests can drive
        // account isolation without a network session. Never used by prod code.
        try {
            window.__dmTestHooks = window.__dmTestHooks || {};
            window.__dmTestHooks.switchToAccount = switchToAccount;
            window.__dmTestHooks.signOutIdentity = signOutIdentity;
            window.__dmTestHooks.handleSession = handleSession;
        } catch (e) {}

        // One-time safety backup of pre-identity local progress (never
        // overwrites an existing backup, never deletes anything).
        try { window.DMIdentity?.ensureBackup?.(); } catch (e) {}

        // Check config first - do not load Supabase if not configured
        if (!checkConfig()) {
            // No config - run app without auth (fully offline-capable)
            showMainApp();
            updateAuthUI(false);
            return;
        }

        // Load Supabase library (CDN, online only - offline keeps working without auth)
        try {
            await loadSupabaseLibrary();
        } catch (e) {
            console.warn("[App] Failed to load Supabase library:", e);
            // Continue without auth/sync features
            showMainApp();
            updateAuthUI(false);
            return;
        }

        // Single Supabase client, owned by AuthModule (never create a second client).
        // AuthModule.init creates exactly one client; everything else reuses it.
        if (window.AuthModule && typeof window.AuthModule.init === "function") {
            if (!window.AuthModule.init(window.SUPABASE_CONFIG)) {
                console.warn("[App] Auth init failed, continuing offline-first");
                showMainApp();
                updateAuthUI(false);
                return;
            }
        }
        var supabaseClient = (window.AuthModule && typeof window.AuthModule.getClient === "function")
            ? window.AuthModule.getClient()
            : null;
        if (!supabaseClient) {
            console.warn("[App] No Supabase client, continuing offline-first");
            showMainApp();
            updateAuthUI(false);
            return;
        }

        // Make the single client globally available (ProfileModule reads it)
        window.supabaseClient = supabaseClient;

        // Initialize Cloud Sync with the same client instance
        if (window.CloudSync && typeof window.CloudSync.init === "function") {
            window.CloudSync.init(supabaseClient);
        }

        // Debounced cloud upload after every local save(): closes the data-loss
        // window between the 60s auto-sync ticks (e.g. tab closed mid-study).
        // Local save always runs first and unchanged; the cloud leg is skipped
        // while signed out, offline, or mid-sync (next save/tick covers it),
        // and uploadChanges queues offline so nothing is lost.
        var saveUploadTimer = null;
        function scheduleCloudUpload() {
            if (saveUploadTimer) { try { clearTimeout(saveUploadTimer); } catch (e) {} }
            saveUploadTimer = setTimeout(function () {
                saveUploadTimer = null;
                try {
                    var user = window.AuthModule?.getUser?.();
                    if (!user || !navigator.onLine) return;
                    if (!window.CloudSync || typeof window.CloudSync.uploadChanges !== "function") return;
                    if (typeof window.CloudSync.getStatus === "function" &&
                        window.CloudSync.getStatus().status === "syncing") return;
                    var r = window.CloudSync.uploadChanges(user.id, window.S);
                    if (r && typeof r.catch === "function") {
                        r.catch(function (e) { console.warn("[App] Scheduled upload failed:", e); });
                    }
                } catch (e) {
                    console.warn("[App] Scheduled upload failed:", e);
                }
            }, 4000);
        }
        try {
            var _origSave = window.save;
            if (typeof _origSave === "function" && !window.save?.__cloudHooked) {
                // NOTE: the actual local write stays inside _origSave; this wrapper
                // only schedules the debounced cloud leg afterwards.
                var hookedSave = function () {
                    var out;
                    try { out = _origSave.apply(this, arguments); }
                    finally { scheduleCloudUpload(); }
                    return out;
                };
                hookedSave.__cloudHooked = true;
                window.save = hookedSave;
                try { save = hookedSave; } catch (e) {}
            }
        } catch (e) {
            console.warn("[App] Cloud save hook install failed:", e);
        }

        // Identity tracking: the Supabase user id (never the email address) is
        // the stable identity. null = guest/offline mode.
        var lastUid = null;

        function currentUidOf(session) {
            try { return (session && session.user && session.user.id) || null; }
            catch (e) { return null; }
        }

        function currentLiveUid() {
            try {
                var u = window.AuthModule?.getUser?.();
                return (u && u.id) || null;
            } catch (e) { return null; }
        }

        // Re-render the profile page only when it is the visible page.
        function refreshProfileIfVisible() {
            try {
                var page = document.getElementById("page-profile");
                if (page && page.classList.contains("active") &&
                    window.ProfileModule && typeof window.ProfileModule.initProfilePage === "function") {
                    window.ProfileModule.initProfilePage();
                }
            } catch (e) {}
        }

        // Post-login per-account work that must run AFTER the identity switch
        // (correct snapshot loaded). Guarded so a stale completion cannot act
        // for an account that is no longer active.
        function postSignIn(uid) {
            if (currentLiveUid() !== uid) return;
            if (window.CloudSync && typeof window.CloudSync.startAutoSync === "function") {
                try { window.CloudSync.startAutoSync(60000); } catch (e) {}
            }
            if (window.AuthModule && typeof window.AuthModule.registerDevice === "function") {
                try { window.AuthModule.registerDevice(); } catch (e) {}
            }
            if (window.ProfileModule && typeof window.ProfileModule.getProfile === "function") {
                try {
                    var gp = window.ProfileModule.getProfile();
                    if (gp && typeof gp.then === "function") {
                        gp.then(function () { refreshProfileIfVisible(); });
                    }
                } catch (e) {}
            }
            refreshProfileIfVisible();
        }

        // Switch live state to the incoming account under STRICT identity
        // isolation: Guest progress must NEVER become an account's progress.
        // The outgoing identity (Guest or previous account) is snapshotted
        // first and never deleted. Then exactly one rule applies:
        //  - account seen on this device before (own snapshot exists):
        //    load its snapshot, then deterministic same-owner sync.
        //  - first time on this device: ask the CLOUD only. Cloud data ->
        //    restore exactly that (never mixed with local state). No cloud
        //    data -> clean default state (never Guest state). Live Guest
        //    state stays in the Guest snapshot, untouched either way.
        async function switchToAccount(uid) {
            var CS = window.CloudSync;
            try { window.DMIdentity?.snapshot?.(); } catch (e) {}
            try { CS?.setActiveUser?.(uid); } catch (e) {}
            try { CS?.stopAutoSync?.(); } catch (e) {}
            var hadSnapshot = false;
            try { hadSnapshot = !!window.DMIdentity?.hasSnapshot?.(uid); } catch (e) {}
            if (!hadSnapshot) {
                var cloudHasData = false;
                try {
                    var client = (window.AuthModule && typeof window.AuthModule.getClient === "function")
                        ? window.AuthModule.getClient() : null;
                    if (client) {
                        var res = await client.from("user_progress").select("state, version").eq("user_id", uid).single();
                        if (!res.error && res.data && res.data.state && Object.keys(res.data.state).length) {
                            cloudHasData = true;
                        }
                    }
                } catch (e) {}
                if (cloudHasData) {
                    // Existing account: restore ONLY its cloud progress.
                    // Activate FIRST so live state is this account's own
                    // (clean defaults when first seen on this device):
                    // downloading over a stale identity's live state would
                    // merge-keep its unknown keys (e.g. guest S.anki) and
                    // leak them into this account under its own key.
                    try { window.DMIdentity?.activate?.(uid); } catch (e) {}
                    var restored = false;
                    try {
                        if (CS && typeof CS.downloadState === "function") {
                            var dl = await CS.downloadState(uid);
                            restored = !!(dl && dl.success);
                        }
                    } catch (e) {
                        console.warn("[App] Account restore failed:", e);
                    }
                    if (!restored) {
                        // Cloud unreachable right now: start clean rather than
                        // exposing Guest state under this account. Later syncs
                        // reconcile; nothing Guest-owned is ever uploaded.
                        try { window.DMIdentity?.activate?.(uid); } catch (e2) {}
                    }
                } else {
                    // Brand-new account: clean default state, never Guest data.
                    // activate() with no snapshot loads defaults, saves them
                    // under this account's key, and re-renders.
                    try { window.DMIdentity?.activate?.(uid); } catch (e) {}
                    // Create the account's cloud record from its own clean
                    // state (never Guest state). Fails silently offline; the
                    // normal sync path creates it on reconnect.
                    try {
                        if (CS && typeof CS.migrateLocalToCloud === "function") {
                            var mig = CS.migrateLocalToCloud(uid, window.S);
                            if (mig && typeof mig.then === "function") await mig;
                        }
                    } catch (e) {
                        console.warn("[App] New-account cloud init failed:", e);
                    }
                }
                try { window.DMIdentity?.snapshot?.(); } catch (e) {}
            } else {
                // Returning account: load its own snapshot, then deterministic
                // same-owner sync (snapshot and cloud both belong to uid).
                try { window.DMIdentity?.activate?.(uid); } catch (e) {}
                try {
                    if (CS && typeof CS.fullSync === "function") await CS.fullSync(uid, window.S);
                } catch (e) {
                    console.warn("[App] Account sync failed:", e);
                }
            }
            try { CS?.refreshPendingCount?.(); } catch (e) {}
        }

        // Sign-out: preserve the outgoing account's live state under its own
        // snapshot, detach sync so nothing else can write for it, restore the
        // guest snapshot, and refresh identity UI. Cloud data is untouched.
        function signOutIdentity() {
            try { window.DMIdentity?.snapshot?.(); } catch (e) {}
            try { window.CloudSync?.setActiveUser?.(null); } catch (e) {}
            try { window.CloudSync?.stopAutoSync?.(); } catch (e) {}
            try { window.CloudSync?.refreshPendingCount?.(); } catch (e) {}
            try { window.DMIdentity?.activate?.(null); } catch (e) {}
            try { window.ProfileModule?.clearCache?.(); } catch (e) {}
            showMainApp();
            updateAuthUI(false);
            refreshProfileIfVisible();
            try {
                if (window.AuthModule?.getUser?.()) {
                    console.warn("[App] Sign-out handled but an account is still active");
                }
            } catch (e) {}
        }

        // Single session handler for listener + initial restore.
        // No login wall: signed-out users keep learning offline/local-first;
        // signing in happens explicitly via the topbar login button.
        // Race guard: every session transition stamps a generation. Async
        // account work (switchToAccount/postSignIn) re-validates it on
        // completion, so a late callback from a previous account (sign in A
        // -> immediately sign out, or A -> B) can never repaint UI or start
        // sync for an identity that is no longer active.
        var sessionGen = 0;
        function handleSession(session, event) {
            var gen = ++sessionGen;
            if (event === "SIGNED_OUT") recoveryMode = false;
            // Password-recovery landing must stay on the auth page until the new
            // password is set (otherwise the main app would hide the recovery UI).
            if (recoveryMode || event === "PASSWORD_RECOVERY") {
                handlePasswordRecovery();
                return;
            }
            var uid = currentUidOf(session);
            if (session && session.user && uid) {
                // User signed in: responsive UI first, identity work async.
                showMainApp();
                updateAuthUI(true);
                if (uid !== lastUid) {
                    var prev = lastUid;
                    lastUid = uid;
                    try { window.ProfileModule?.clearCache?.(); } catch (e) {}
                    refreshProfileIfVisible();
                    switchToAccount(uid).then(function () {
                        if (gen !== sessionGen) return;
                        postSignIn(uid);
                    }).catch(function (e) {
                        if (gen !== sessionGen) return;
                        console.warn("[App] Account switch failed:", e);
                        postSignIn(uid);
                    });
                } else {
                    postSignIn(uid);
                }
            } else {
                // Signed out (or no previous session) - stay in the app, offline-first
                if (lastUid !== null) {
                    lastUid = null;
                    signOutIdentity();
                } else {
                    showMainApp();
                    updateAuthUI(false);
                    if (window.CloudSync && typeof window.CloudSync.stopAutoSync === "function") {
                        try { window.CloudSync.stopAutoSync(); } catch (e) {}
                    }
                }
            }
        }

        // OAuth callback hygiene (PKCE `?code=` / `?error=` are single-use).
        // The Supabase client silently ignores callbacks it cannot exchange
        // (missing PKCE verifier after a cross-browser/context return, expired
        // or reused code, provider refusals): no event, no error, session stays
        // null, and the dead params linger in the URL so every reload replays
        // the dead exchange. Detect those shapes here using param NAMES only
        // (never values), surface a retry message through the existing auth UI,
        // then drop ONLY the consumed OAuth params (all other query params are
        // preserved). Never touches session state; read-only session checks.
        function handleOAuthCallback() {
            var params = null;
            try {
                var search = window.location.search || "";
                if (!search) return;
                params = new URLSearchParams(search);
            } catch (e) { return; }
            var hasCode = false, errName = null;
            try {
                hasCode = params.has("code");
                errName = params.get("error");
            } catch (e) { return; }
            if (!hasCode && !errName) return;

            function stripOAuthParams() {
                try {
                    var p = new URLSearchParams(window.location.search || "");
                    var keys = ["code", "state", "error", "error_description", "error_code"];
                    var changed = false;
                    keys.forEach(function (k) { if (p.has(k)) { p.delete(k); changed = true; } });
                    if (!changed) return;
                    var rest = p.toString();
                    var next = window.location.pathname + (rest ? "?" + rest : "") + (window.location.hash || "");
                    window.history.replaceState(null, "", next);
                } catch (e) {}
            }

            function liveHasSession() {
                try {
                    var s = (window.AuthModule && typeof window.AuthModule.getSession === "function") ? window.AuthModule.getSession() : null;
                    return !!(s && s.user);
                } catch (e) { return false; }
            }

            // Provider/server refusals are deterministic failures: message + clean now.
            // The error NAME (never description/values) is appended so the exact
            // refusal is visible for diagnosis (e.g. access_denied after leaving
            // Google's consent screen vs a server-side refusal).
            if (errName) {
                if (!liveHasSession()) {
                    var safeCode = String(errName).slice(0, 60);
                    try { console.warn("[App] OAuth callback refused (param names only): error"); } catch (e) {}
                    var mapped = window.AuthModule?.translateError?.({ message: "OAuth " + safeCode }) || "حدث خطأ في تسجيل الدخول. حاول مرة أخرى.";
                    showAuthMessage(mapped + " (" + safeCode + ")");
                }
                stripOAuthParams();
                return;
            }

            // `?code=` with a live session: exchange already succeeded; just clean.
            if (liveHasSession()) { stripOAuthParams(); return; }

            // `?code=` without a session yet: the exchange may still be in flight
            // (slow network), so re-check after a grace period instead of alarming
            // now. A still-dead code then gets a retry message and is cleaned so
            // reloads cannot replay it.
            setTimeout(function () {
                try {
                    if (recoveryMode) { stripOAuthParams(); return; }
                    if (liveHasSession()) { stripOAuthParams(); return; }
                    var still = false;
                    try { still = new URLSearchParams(window.location.search || "").has("code"); } catch (e) {}
                    if (!still) return;
                    try { console.warn("[App] OAuth code did not yield a session; cleaned dead callback params"); } catch (e) {}
                    showAuthMessage("تعذر إتمام تسجيل الدخول. حاول تسجيل الدخول مرة أخرى.");
                    stripOAuthParams();
                } catch (e) {}
            }, 8000);
        }

        // Set up auth state listener
        if (window.AuthModule && typeof window.AuthModule.onAuthStateChange === "function") {
            window.AuthModule.onAuthStateChange(function(event, session) {
                console.log("[App] Auth state:", event, session ? "authenticated" : "unauthenticated");
                handleSession(session || null, event);
            });
        }

        // Initialize auth UI buttons (guarded - auth forms exist on index.html only)
        initAuthUI();

        // Restore existing session (fires the handler exactly once)
        if (window.AuthModule && typeof window.AuthModule.initialize === "function") {
            try {
                var initResult = await window.AuthModule.initialize();
                // OAuth PKCE race guard: SIGNED_IN may have arrived via
                // onAuthStateChange while initialize() was in flight — prefer
                // the live session over the stale initResult snapshot.
                var liveSession = (window.AuthModule && typeof window.AuthModule.getSession === "function") ? window.AuthModule.getSession() : null;
                handleSession(liveSession || (initResult && initResult.session) || null);
            } catch (e) {
                console.warn("[App] Session restore failed:", e);
                handleSession(null);
            }
        } else {
            handleSession(null);
        }

        // Surface + clean single-use OAuth callback params (no-op without them).
        try { handleOAuthCallback(); } catch (e) {}

        // Hook into profile page navigation
        var originalShowPage = window.showPage;
        if (originalShowPage && !originalShowPage.__authWrapped) {
            originalShowPage.__authWrapped = true;
            window.showPage = function(name) {
                if (name === "profile") {
                    initProfilePage();
                }
                return originalShowPage(name);
            };
        }

        // Sync status listener for UI
        // (Sync indicator is updated by CloudSync internally)
        if (window.CloudSync && typeof window.CloudSync.onStatusChange === "function") {
            window.CloudSync.onStatusChange(function() {});
        }

        console.log("[App] Initialization complete");
    }

    // Run initialization when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() {
            initializeApp().catch(function(e) {
                console.warn("[App] Initialization failed:", e);
            });
        });
    } else {
        initializeApp().catch(function(e) {
            console.warn("[App] Initialization failed:", e);
        });
    }
})();