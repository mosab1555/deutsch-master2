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
            currentSession = data.session;
            currentUser = data.session?.user || null;
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
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Sign in with Facebook
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
            return { data, error };
        } catch (e) {
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
            return { data, error };
        } catch (e) {
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
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Send Phone OTP
    async function sendPhoneOTP(phone) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const { data, error } = await supabaseClient.auth.signInWithOtp({
                phone: phone.trim(),
                options: {
                    channel: "sms"
                }
            });
            return { data, error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Verify Phone OTP
    async function verifyPhoneOTP(phone, token) {
        if (!supabaseClient) return { error: "Supabase not initialized" };

        try {
            const { data, error } = await supabaseClient.auth.verifyOtp({
                phone: phone.trim(),
                token: token.trim(),
                type: "sms"
            });
            return { data, error };
        } catch (e) {
            return { error: e.message };
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

        try {
            const { error } = await supabaseClient.auth.signOut();
            currentSession = null;
            currentUser = null;
            return { error };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Get redirect URL based on environment
    function getRedirectUrl() {
        const config = window.SUPABASE_CONFIG || {};
        const isLocalhost = window.location.hostname === "localhost" ||
                           window.location.hostname === "127.0.0.1";
        return isLocalhost ? config.redirectUrls?.local : config.redirectUrls?.production;
    }

    // ==================== ERROR HANDLING ====================

    // Convert Supabase auth errors to user-friendly Arabic messages
    function translateError(error) {
        if (!error) return "حدث خطأ غير معروف";

        const msg = error.message || error.error_description || error.error || String(error);

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

        if (msg.includes("Invalid OTP") || msg.includes("invalid_token") || msg.includes("otp_expired")) {
            return "رمز التحقق غير صحيح أو منتهي الصلاحية. اطلب رمزاً جديداً.";
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

    // Log auth event
    async function logAuthEvent(eventType, provider, success, errorMessage) {
        if (!supabaseClient) return;

        try {
            await supabaseClient.from("auth_events").insert({
                user_id: currentUser?.id,
                event_type: eventType,
                provider,
                success,
                error_message: errorMessage,
                ip_address: null, // Will be filled by Supabase if needed
                user_agent: navigator.userAgent
            });
        } catch (e) {
            console.warn("[Auth] Failed to log auth event:", e);
        }
    }

    // Public API
    return {
        init: initSupabase,
        initialize,
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