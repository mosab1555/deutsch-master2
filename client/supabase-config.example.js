// Deutsch Master - Supabase Configuration
// Copy to client/supabase-config.js and fill in your values
// NEVER commit real keys to Git!

window.SUPABASE_CONFIG = {
    // Get these from Supabase Dashboard > Settings > API
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_ANON_KEY_HERE',

    // OAuth redirect URLs (configure in Supabase Dashboard > Authentication > URL Configuration)
    // For GitHub Pages: https://YOUR_USERNAME.github.io/REPO_NAME/
    // For local dev: http://localhost:PORT/
    redirectUrls: {
        local: 'http://127.0.0.1:5500/',
        production: 'https://mosab1555.github.io/deutsch-master2/'
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.SUPABASE_CONFIG;
}