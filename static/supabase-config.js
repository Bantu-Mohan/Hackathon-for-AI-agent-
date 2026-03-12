// =============================================
// Supabase Configuration
// =============================================
// Replace these with your Supabase project credentials
// Found at: https://app.supabase.com → Project Settings → API

const SUPABASE_URL = window.ENV ? window.ENV.SUPABASE_URL : '';
const SUPABASE_ANON_KEY = window.ENV ? window.ENV.SUPABASE_ANON_KEY : '';

let supabaseClient = null;

try {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || !SUPABASE_URL) {
        console.error("Supabase credentials are not set!");
    } else {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (err) {
    console.error("Failed to initialize Supabase client:", err);
}
