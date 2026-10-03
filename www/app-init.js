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
        // Hide sidebar
        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("sidebarOverlay")?.classList.remove("show");
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

    // Update auth UI in topbar (scope-level so every flow can reach it)
    function updateAuthUI(isLoggedIn) {
        var loginBtn = document.getElementById("loginBtn");
        var userMenu = document.getElementById("userMenu");
        if (isLoggedIn) {
            if (loginBtn) loginBtn.style.display = "none";
            if (userMenu) userMenu.classList.remove("hidden");
        } else {
            if (loginBtn) loginBtn.style.display = "";
            if (userMenu) userMenu.classList.add("hidden");
        }
    }

    // Password-recovery completion (the reset EMAIL is sent by AuthModule.resetPassword;
    // this wires the landing side: after the user clicks the email link, Supabase
    // fires PASSWORD_RECOVERY and AuthModule.updatePassword sets the new password).
    // Dynamic strings only (no new data-i18n keys, no dict changes).
    var recoveryMode = false;
    function handlePasswordRecovery() {
        recoveryMode = true;
        showAuthPage();
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

    // Show auth message
    function showAuthMessage(message, isError) {
        var el = document.getElementById("authMessage");
        if (!el) return;
        el.textContent = message;
        el.className = "auth-message " + (isError ? "error" : "success");
        setTimeout(function() { el.textContent = ""; el.className = "auth-message"; }, 8000);
    }

    // Set loading state on button
    function setButtonLoading(btn, loading, originalText) {
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = window.t?.("loading") || "\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644...";
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || originalText || "";
        }
    }

    // Initialize auth UI handlers
    function initAuthUI() {
        // Google Sign In
        document.getElementById("btnGoogle")?.addEventListener("click", function() {
            var btn = document.getElementById("btnGoogle");
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
            var email = document.getElementById("authEmail")?.value?.trim();
            var password = document.getElementById("authPassword")?.value;
            var btn = document.getElementById("btnSignIn");

            if (!email || !password) return;

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

        // Forgot Password
        document.getElementById("btnForgotPassword")?.addEventListener("click", function() {
            var email = document.getElementById("authEmail")?.value?.trim();
            if (!email) {
                showAuthMessage(window.t?.("enter_email_first") || "\u0623\u062F\u062E\u0644 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648\u0644\u0627");
                return;
            }

            var btn = document.getElementById("btnForgotPassword");
            setButtonLoading(btn, true);
            var promise = window.AuthModule?.resetPassword?.(email);
            promise?.then(function(result) {
                setButtonLoading(btn, false, window.t?.("forgot_password") || "\u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u063F");
                if (result?.error) {
                    showAuthMessage(window.AuthModule?.translateError?.(result.error) || result.error);
                } else {
                    showAuthMessage(window.t?.("reset_email_sent") || "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0625\u0644\u0649 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", false);
                }
            });
        });

        // Send OTP
        document.getElementById("btnSendOTP")?.addEventListener("click", function() {
            var phone = document.getElementById("authPhone")?.value?.trim();
            var btn = document.getElementById("btnSendOTP");

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

        // Topbar login button
        document.getElementById("loginBtn")?.addEventListener("click", function() {
            showAuthPage();
        });

        // Topbar profile button
        document.getElementById("profileBtn")?.addEventListener("click", function() {
            if (typeof showPage === "function") showPage("profile");
        });

        // Topbar logout button
        document.getElementById("logoutBtn")?.addEventListener("click", function() {
            if (window.AuthModule && typeof window.AuthModule.signOut === "function") {
                window.AuthModule.signOut();
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

        // Single session handler for listener + initial restore.
        // No login wall: signed-out users keep learning offline/local-first;
        // signing in happens explicitly via the topbar login button.
        function handleSession(session, event) {
            if (event === "SIGNED_OUT") recoveryMode = false;
            // Password-recovery landing must stay on the auth page until the new
            // password is set (otherwise the main app would hide the recovery UI).
            if (recoveryMode || event === "PASSWORD_RECOVERY") {
                handlePasswordRecovery();
                return;
            }
            if (session && session.user) {
                // User signed in
                showMainApp();
                updateAuthUI(true);
                var state = window.S;
                if (!state) {
                    console.warn("[App] Local store unavailable, skipping cloud sync");
                } else if (window.CloudSync && typeof window.CloudSync.migrateLocalToCloud === "function") {
                    try {
                        var mig = window.CloudSync.migrateLocalToCloud(session.user.id, state);
                        if (mig && typeof mig.catch === "function") {
                            mig.catch(function (e) { console.warn("[App] First-login migration failed:", e); });
                        }
                    } catch (e) {
                        console.warn("[App] First-login migration failed:", e);
                    }
                }
                // Start auto sync
                if (window.CloudSync && typeof window.CloudSync.startAutoSync === "function") {
                    window.CloudSync.startAutoSync(60000);
                }
                // Register device
                if (window.AuthModule && typeof window.AuthModule.registerDevice === "function") {
                    window.AuthModule.registerDevice();
                }
                // Load profile
                if (window.ProfileModule && typeof window.ProfileModule.getProfile === "function") {
                    window.ProfileModule.getProfile();
                }
            } else {
                // Signed out (or no previous session) - stay in the app, offline-first
                showMainApp();
                updateAuthUI(false);
                if (window.CloudSync && typeof window.CloudSync.stopAutoSync === "function") {
                    window.CloudSync.stopAutoSync();
                }
            }
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