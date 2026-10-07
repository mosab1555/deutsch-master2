/* Deutsch Master - Authentication Module
   Supabase Auth integration with Google, Email/Password, Phone OTP, Facebook
   Local-first architecture with session persistence
*/
"use strict";

const AuthModule = (function () {
    "use strict";

    let supabaseClient = null;
    let authStateCallback = null;
    let currentSession = null;
    let currentUser = null;
    let deviceId = null;

    // Generate or retrieve device ID
    function getDeviceId() {
        if (deviceId) return deviceId;
        try {
            deviceId = localStorage.getItem("dm_device_id");
            if (!deviceId) {
                deviceId = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 9);
                localStorage.setItem("dm_device_id", deviceId);
            }
        } catch (e) {
            deviceId = "dev_" + Date.now().toString(36);
        }
        return deviceId;
    }

    // Initialize Supabase client
    function initSupabase(config) {
        if (typeof window.supabase === "undefined") {
            console.error("[Auth] Supabase JS library not loaded");
            return false;
        }

        if (!config || !config.url || !config.anonKey) {
            console.error("[Auth] Missing Supabase configuration");
            return false;
        }

        supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: "pkce"
            }
        });

        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("[Auth] State changed:", event, session ? "session exists" : "no session");
            currentSession = session;
            currentUser = session?.user || null;

            if (authStateCallback) {
                try {
                    authStateCallback(event, session);
                } catch (e) {
                    console.error("[Auth] State callback error:", e);
                }
            }
        });

        return true;
    }

    // Get current session
    function getSession() {
        return currentSession;
    }

    // Get current user
    function getUser() {
        return currentUser;
    }

    // Get the single shared Supabase client (created by init).
    // Other modules must reuse this instance - never create a second client.
    function getClient() {
        return supabaseClient;
    }

    // Check if authenticated
    function isAuthenticated() {
        return !!currentUser;
    }

    // Set auth state change callback
    function onAuthStateChange(callback) {
        authStateCallback = callback;
    }

    // Initialize auth (check existing session)
    async function initialize() {
        if (!supabaseClient) {
            console.warn("[Auth] Supabase not initialized");
            return { user: null, session: null };
        }

        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) {
                console.error("[Auth] Get session error:", error);
                return { user: null, session: null, error: error.message };
            }
            // OAuth PKCE race guard: getSession() may resolve null while the
            // code exchange is still in flight; onAuthStateChange(SIGNED_IN)
            // may have already stored the fresh session — never clobber it.
            if (data.session) {
                currentSession = data.session;
                currentUser = data.session?.user || null;
            }
            return { user: currentUser, session: currentSession };
        } catch (e) {
            console.error("[Auth] Initialize error:", e);
            return { user: null, session: null, error: e.message };
        }
    }

    // ==================== AUTH METHODS ====================

    // Sign in with Google
    async function signInWithGoogle() {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const redirectUrl = getRedirectUrl();
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent"
                    }
                }
            });
            logAuthEvent("sign_in", "google", !error, errorMessageOf(error), null);
            return { data, error };
        } catch (e) {
            logAuthEvent("sign_in", "google", false, e.message, null);
            return { error: e.message };
        }
    }

    // Sign in with Facebook (official Supabase OAuth provider id: "facebook").
    // Requires the provider to be enabled in the Supabase Dashboard
    // (Authentication > Providers > Facebook) with a Meta App ID/secret;
    // when it is not, Supabase answers HTTP 400 validation_failed
    // ("Unsupported provider: provider is not enabled") and no browser
    // redirect happens - the caller surfaces translateError(result.error).
    async function signInWithFacebook() {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const redirectUrl = getRedirectUrl();
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: "facebook",
                options: {
                    redirectTo: redirectUrl
                }
            });
            logAuthEvent("sign_in", "facebook", !error, errorMessageOf(error), null);
            return { data, error };
        } catch (e) {
            logAuthEvent("sign_in", "facebook", false, e.message, null);
            return { error: e.message };
        }
    }

    // Sign in with Email/Password
    async function signInWithEmail(email, password) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            });
            logAuthEvent("sign_in", "email", !error, error?.message, data?.user?.id);
            return { data, error };
        } catch (e) {
            logAuthEvent("sign_in", "email", false, e.message, null);
            return { error: e.message };
        }
    }

    // Sign up with Email/Password
    async function signUpWithEmail(email, password, displayName) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const redirectUrl = getRedirectUrl();
            const { data, error } = await supabaseClient.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        full_name: displayName || ""
                    },
                    emailRedirectTo: redirectUrl
                }
            });
            logAuthEvent("sign_up", "email", !error, error?.message, data?.user?.id);
            return { data, error };
        } catch (e) {
            logAuthEvent("sign_up", "email", false, e.message, null);
            return { error: e.message };
        }
    }

    // ==================== PHONE OTP HELPERS ====================
    //
    // Egyptian mobile normalization (single authority for phone auth).
    // Accepts: 010xxxxxxxx / 011 / 012 / 015, +20..., 20..., 0020...,
    // values with spaces/dashes/parens, Arabic-Indic digits.
    // Returns the E.164 form ("+2010...") or null when clearly invalid.
    // Already-normalized international E.164 numbers pass through untouched
    // (never transformed twice). Invalid input is rejected, never coerced
    // into a different valid number.
    function normalizeEgyptianPhone(raw) {
        try {
            if (raw == null) return null;
            var s = String(raw).trim();
            if (!s) return null;
            // Arabic-Indic + Eastern Arabic-Indic digits -> ASCII.
            s = s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (ch) {
                var code = ch.charCodeAt(0);
                if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
                return String(code - 0x06F0);
            });
            s = s.trim();
            // A "+" anywhere except position 0 is malformed: reject.
            if (s.indexOf("+", 1) !== -1) return null;
            var hasPlus = s.charAt(0) === "+";
            // Strip separators but keep a single leading "+".
            var digits = s.replace(/[^\d]/g, "");
            if (!digits) return null;
            if (hasPlus) {
                // Already international: validate generic E.164, pass through.
                if (/^20(10|11|12|15)\d{8}$/.test(digits)) return "+" + digits;
                // A "+20..." number at Egyptian length with a non-mobile
                // prefix (e.g. +2019...) is a typo, not a foreign number:
                // reject instead of passing a broken number to Supabase.
                if (/^20\d{10}$/.test(digits)) return null;
                if (/^\d{7,15}$/.test(digits)) return "+" + digits;
                return null;
            }
            // "00" international prefix -> treat like "+".
            if (/^0020(10|11|12|15)\d{8}$/.test(digits)) return "+" + digits.slice(2);
            if (/^00\d{7,15}$/.test(digits)) return "+" + digits.slice(2);
            // "20" + Egyptian mobile without "+" (e.g. 201095202373).
            if (/^20(10|11|12|15)\d{8}$/.test(digits)) return "+" + digits;
            // Local Egyptian mobile: "01X" + 8 digits.
            if (/^01(0|1|2|5)\d{8}$/.test(digits)) return "+2" + digits;
            // Bare 10-digit mobile without trunk zero (e.g. 1095202373).
            if (/^1(0|1|2|5)\d{8}$/.test(digits)) return "+20" + digits;
            return null;
        } catch (e) { return null; }
    }

    // OTP sanitizer: ignores accidental spaces/separators, keeps digits only.
    function sanitizeOtpCode(raw) {
        try {
            if (raw == null) return "";
            var digits = String(raw).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, function (ch) {
                var code = ch.charCodeAt(0);
                if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
                return String(code - 0x06F0);
            }).replace(/[^\d]/g, "");
            return digits;
        } catch (e) { return ""; }
    }

    // Send Phone OTP (SMS channel). Normalizes to E.164 first so Egyptian
    // trunk numbers ("010...") are never sent raw to Supabase.
    async function sendPhoneOTP(phone) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        var normalized = normalizeEgyptianPhone(phone);
        if (!normalized) {
            return { error: "رقم الهاتف غير صحيح. أدخل رقمًا مصريًا صحيحًا." };
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithOtp({
                phone: normalized,
                options: {
                    channel: "sms"
                }
            });
            if (error) {
                console.warn("[Auth] sendPhoneOTP failed:", errorMessageOf(error));
            } else {
                logAuthEvent("sign_in", "phone", true, null, null);
            }
            return { data, error, phone: normalized };
        } catch (e) {
            console.warn("[Auth] sendPhoneOTP threw:", e && e.message ? e.message : e);
            return { error: (e && e.message) || e };
        }
    }

    // Verify Phone OTP. Uses the same normalization as sendPhoneOTP so the
    // (phone, token) pair always matches what the SMS was requested for.
    async function verifyPhoneOTP(phone, token) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        var normalized = normalizeEgyptianPhone(phone);
        if (!normalized) {
            return { error: "رقم الهاتف غير صحيح. أدخل رقمًا مصريًا صحيحًا." };
        }
        var code = sanitizeOtpCode(token);
        if (!/^\d{6}$/.test(code)) {
            return { error: "رمز التحقق غير صحيح." };
        }

        try {
            const { data, error } = await supabaseClient.auth.verifyOtp({
                phone: normalized,
                token: code,
                type: "sms"
            });
            if (error) {
                console.warn("[Auth] verifyPhoneOTP failed:", errorMessageOf(error));
            } else {
                logAuthEvent("sign_in", "phone", true, null, data?.user?.id || null);
            }
            return { data, error, phone: normalized };
        } catch (e) {
            console.warn("[Auth] verifyPhoneOTP threw:", e && e.message ? e.message : e);
            return { error: (e && e.message) || e };
        }
    }

    // Send Email OTP (Magic Link)
    async function sendEmailOTP(email) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const redirectUrl = getRedirectUrl();
            const { data, error } = await supabaseClient.auth.signInWithOtp({
                email: email.trim().toLowerCase(),
                options: {
                    emailRedirectTo: redirectUrl
                }
            });
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Reset Password
    async function resetPassword(email) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const redirectUrl = getRedirectUrl();
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: redirectUrl
            });
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Update Password (after reset)
    async function updatePassword(newPassword) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const { data, error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Sign Out
    async function signOut() {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        // Log while still authenticated (logging never blocks logout)
        const uid = currentUser?.id || null;
        const prov = currentUser?.app_metadata?.provider || null;
        logAuthEvent("sign_out", prov, true, null, uid);
        try {
            const { error } = await supabaseClient.auth.signOut();
            currentSession = null;
            currentUser = null;
            return { error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Get redirect URL based on environment.
    // Central helper for every OAuth/email redirect (single authority).
    // Never invents provider credentials; only selects the target URL.
    // Fallback is the current document URL (same origin the user is on),
    // so a missing config can never produce redirectTo: undefined.
    // Native shells (Capacitor) must never receive the desktop dev-server
    // URL: they echo their own WebView origin instead.
    function getRedirectUrl() {
        var config = window.SUPABASE_CONFIG || {};
        var urls = config.redirectUrls || {};
        var host = "";
        try { host = window.location.hostname || ""; } catch (e) {}
        var nativeShell = false;
        try {
            var Cap = window.Capacitor;
            nativeShell = !!(Cap && (Cap.isNative === true ||
                (typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform())));
        } catch (e2) { nativeShell = false; }
        if (!nativeShell && (host === "localhost" || host === "127.0.0.1")) {
            return urls.local || currentDocUrl();
        }
        if (!nativeShell && urls.production) return urls.production;
        return currentDocUrl() || urls.production;
    }
    function currentDocUrl() {
        try { return window.location.origin + window.location.pathname; }
        catch (e) { return undefined; }
    }

    // Short safe message extractor for error-shaped values, including the
    // Supabase HTTP-400 shape { code, error_code, msg } which carries no
    // .message field. Never includes tokens (only short error text).
    function errorMessageOf(error) {
        try {
            if (!error) return null;
            if (typeof error === "string") return error.slice(0, 500);
            var m = error.message || error.msg || error.error_description ||
                error.error || error.error_code || null;
            return m ? String(m).slice(0, 500) : null;
        } catch (e) { return null; }
    }

    // ==================== ERROR HANDLING ====================

    // Convert Supabase auth errors to user-friendly Arabic messages.
    // providerHint ("google" | "facebook" | "phone") only customizes the
    // provider name inside provider-specific messages; omit it to keep
    // generic wording. Phone flows MUST pass "phone" so phone/SMS errors are
    // never misreported as OAuth/external-account errors.
    // Phone-specific patterns are matched before the generic OAuth branch
    // even without a hint, so a phone error can never fall into the
    // "external account" message.
    function translateError(error, providerHint) {
        if (!error) return "حدث خطأ غير معروف";

        const raw = errorMessageOf(error) || String(error);
        const msg = String(raw);
        let errCode = "";
        try { errCode = String(error.error_code || error.code || ""); } catch (e) {}

        const providerAr = providerHint === "facebook" ? "فيسبوك"
            : providerHint === "google" ? "Google" : null;

        // Provider disabled in the Supabase Dashboard (HTTP 400
        // validation_failed, "Unsupported provider: provider is not enabled").
        // Code-side the call is correct; only external config can enable it.
        if (/unsupported provider|provider is not enabled|provider.*not enabled|not enabled.*provider/i.test(msg) ||
            (/validation_failed/i.test(errCode + " " + msg) && /provider/i.test(msg))) {
            // Phone flows never surface the OAuth/external wording, even
            // when Supabase answers with a generic provider-disabled error.
            if (providerHint === "phone") {
                return "تسجيل الدخول برقم الهاتف غير متاح حاليًا لأن خدمة SMS غير مفعلة.";
            }
            return providerAr
                ? ("تسجيل الدخول عبر " + providerAr + " غير متاح حاليًا. جرّب مرة أخرى لاحقًا.")
                : "تسجيل الدخول عبر الحساب الخارجي غير متاح حاليًا. جرّب مرة أخرى لاحقًا.";
        }

        // User cancelled at the provider (OAuth access_denied on return).
        if (/access_denied|user (cancelled|canceled|denied)|cancelled/i.test(msg)) {
            return "تم إلغاء تسجيل الدخول. يمكنك المحاولة مرة أخرى في أي وقت.";
        }

        // Network errors
        if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
            return "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.";
        }

        // Auth errors
        if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
            return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        }

        if (msg.includes("Email not confirmed")) {
            return "يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد.";
        }

        if (msg.includes("User already registered") || msg.includes("already registered")) {
            return "هذا البريد الإلكتروني مستخدم بالفعل. حاول تسجيل الدخول بدلاً من ذلك.";
        }

        if (msg.includes("Phone number already registered")) {
            return "رقم الهاتف هذا مسجل بالفعل. حاول تسجيل الدخول.";
        }

        // ---------- Phone / SMS OTP errors (must precede the OAuth branch) ----------
        // SMS provider not configured on the Supabase project:
        // Dashboard > Authentication > Providers > Phone must be enabled with
        // an SMS provider (e.g. Twilio). No code-side fix can substitute that;
        // the frontend reports it explicitly instead of faking success.
        if (/sms.*not|phone.*not.*enabl|phone.*signup.*disabl|signup.*phone.*disabl|phone.*not.*configur|twilio|message.*provider.*not|sms.*provider/i.test(msg) ||
            (/unsupported provider|provider is not enabled|provider.*not enabled|not enabled.*provider/i.test(msg) &&
                (/phone|sms|twilio/i.test(msg) || providerHint === "phone"))) {
            return "تسجيل الدخول برقم الهاتف غير متاح حاليًا لأن خدمة SMS غير مفعلة.";
        }

        // Invalid phone number format (Supabase expects E.164, e.g. +2010...).
        if (/invalid.*phone|phone.*invalid|e\.?\s?164|phone number.*not valid|must be a valid phone/i.test(msg)) {
            return "رقم الهاتف غير صحيح. أدخل رقمًا مصريًا صحيحًا.";
        }

        // Local pre-validation message passes through untouched.
        if (/أدخل رقمًا مصريًا صحيحًا/.test(msg)) {
            return msg.slice(0, 200);
        }

        // Expired OTP (checked before generic invalid-OTP so otp_expired maps here).
        if (/otp_expired|expired.*otp|otp.*expired/i.test(msg) ||
            (/expired/i.test(msg) && /otp|token|code|verification/i.test(msg))) {
            return "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.";
        }

        // Wrong OTP code.
        if (/invalid.*(otp|token|code)|invalid_token|(otp|token|code).*invalid|wrong.*(otp|code)|incorrect.*(otp|code)/i.test(msg)) {
            return "رمز التحقق غير صحيح.";
        }

        // Too many verification attempts (distinct from send rate limits).
        if (/too many.*attempt|attempt.*exceed|max.*attempt|too many.*verif|verif.*attempt/i.test(msg)) {
            return "تم تجاوز عدد محاولات التحقق. حاول مرة أخرى لاحقًا.";
        }

        // Send/verify rate limits (Supabase: over_sms_send_rate_limit, etc.).
        if (/too many requests|rate.?limit|over_.*rate_limit|sms_send_rate_limited|rate_limited|too many.*(sms|otp|code)/i.test(msg)) {
            return "لقد طلبت رموز تحقق كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
        }

        // Phone OTP fallback (never the OAuth/external message).
        if (providerHint === "phone") {
            if (/network|fetch|connection|failed to fetch|load failed/i.test(msg)) {
                return "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.";
            }
            console.log("[Auth] Untranslated phone error:", msg);
            return "حدث خطأ في تسجيل الدخول برقم الهاتف. حاول مرة أخرى.";
        }

        if (msg.includes("OTP expired") || msg.includes("expired")) {
            return "انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً.";
        }

        if (msg.includes("Too many requests") || msg.includes("rate limit")) {
            return "كثير من المحاولات. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.";
        }

        if (msg.includes("OAuth") || msg.includes("oauth") || msg.includes("provider")) {
            return "حدث خطأ في تسجيل الدخول عبر الحساب الخارجي. حاول مرة أخرى.";
        }

        if (msg.includes("Weak password") || msg.includes("password")) {
            return "كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل.";
        }

        if (msg.includes("Invalid email")) {
            return "تنسيق البريد الإلكتروني غير صحيح.";
        }

        // Default fallback
        console.log("[Auth] Untranslated error:", msg);
        return "حدث خطأ في تسجيل الدخول. حاول مرة أخرى.";
    }

    // ==================== PROFILE HELPERS ====================

    // Get user profile
    async function getProfile() {
        if (!supabaseClient || !currentUser) return { data: null, error: "Not authenticated" };

        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single();

            return { data, error };
        } catch (e) {
            return { data: null, error: e.message };
        }
    }

    // Update user profile
    async function updateProfile(updates) {
        if (!supabaseClient || !currentUser) return { error: "Not authenticated" };

        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq("id", currentUser.id)
                .select()
                .single();

            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Register device
    async function registerDevice(deviceName, platform) {
        if (!supabaseClient || !currentUser) return { error: "Not authenticated" };

        try {
            const devId = getDeviceId();
            const { data, error } = await supabaseClient
                .from("devices")
                .upsert({
                    user_id: currentUser.id,
                    device_id: devId,
                    device_name: deviceName || navigator.userAgent,
                    platform: platform || getPlatform(),
                    last_sync_at: new Date().toISOString()
                }, { onConflict: "user_id,device_id" })
                .select()
                .single();

            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    function getPlatform() {
        const ua = navigator.userAgent;
        if (/android/i.test(ua)) return "android";
        if (/iphone|ipad|ipod/i.test(ua)) return "ios";
        if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
        if (navigator.userAgent.includes("Electron")) return "electron";
        return "web";
    }

    // Log auth event (only safe metadata - never tokens, passwords, or keys).
    // Fail-safe: logging must never break the auth flow (RLS may deny it).
    async function logAuthEvent(eventType, provider, success, errorMessage, userId) {
        if (!supabaseClient) return;

        try {
            await supabaseClient.from("auth_events").insert({
                user_id: userId || currentUser?.id || null,
                event_type: eventType,
                provider: provider || null,
                success: success === true,
                error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
                ip_address: null, // Will be filled by Supabase if needed
                user_agent: (navigator.userAgent || "").slice(0, 500)
            });
        } catch (e) {
            console.warn("[Auth] Failed to log auth event:", e);
        }
    }

    // Public API
    return {
        init: initSupabase,
        initialize,
        getClient,
        getSession,
        getUser,
        isAuthenticated,
        onAuthStateChange,
        signInWithGoogle,
        signInWithFacebook,
        signInWithEmail,
        signUpWithEmail,
        sendPhoneOTP,
        verifyPhoneOTP,
        normalizeEgyptianPhone,
        sanitizeOtpCode,
        sendEmailOTP,
        resetPassword,
        updatePassword,
        signOut,
        getProfile,
        updateProfile,
        registerDevice,
        translateError,
        getDeviceId,
        logAuthEvent
    };
})();

// Export for global access
window.AuthModule = AuthModule;

// Node export for testing
if (typeof module !== "undefined" && module.exports) {
    module.exports = AuthModule;
}