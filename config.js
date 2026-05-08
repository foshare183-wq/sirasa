// config.js
const SUPABASE_URL = 'https://URL_PROJECT_KAMU.supabase.co'; // GANTI INI
const SUPABASE_ANON_KEY = 'KODE_ANON_KEY_KAMU_YANG_PANJANG'; // GANTI INI

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
