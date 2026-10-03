// Deutsch Master - Supabase browser configuration.
//
// This file is intentionally committed: it holds ONLY the browser-safe
// Publishable key, which is public by design. All user data is protected
// by Supabase Row Level Security (RLS), never by key secrecy.
//
// NEVER put privileged credentials here:
//   sb_secret_... / service_role / SUPABASE_SERVICE_ROLE_KEY
// Those must never appear in client/, www/, or any committed file.
//
// Until `anonKey` is filled with the real Publishable key
// (Supabase Dashboard > Project Settings > API), auth and cloud sync stay
// disabled and the app keeps working fully offline from localStorage.
window.SUPABASE_CONFIG = {
    url: "https://bhdgpscedjowchldsjnd.supabase.co",
    // TODO: paste the Supabase Publishable key here (starts with sb_publishable_).
    anonKey: "sb_publishable_uXuF7XTCdEjkcsKiHSKpbA_hT6kkbCg",
    // OAuth / email redirect targets (allowed in Supabase Dashboard > Authentication > URL Configuration)
    redirectUrls: {
        local: "http://127.0.0.1:5500/",
        production: "https://mosab1555.github.io/deutsch-master2/"
    }
};
