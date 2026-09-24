// Konfigurasi koneksi Supabase.
//
// File ini MEMANG ikut di-commit karena GitHub Pages hanya bisa menyajikan
// file yang ada di repository. Itu aman SELAMA:
//   1. yang diisi di sini hanya "anon / publishable key" (bukan service_role), dan
//   2. Row Level Security (RLS) aktif, lihat supabase/02_rls_policies.sql.
//
// JANGAN PERNAH menaruh service_role key di file mana pun di repo ini.
const CONFIG = {
    SUPABASE_URL: "https://XXXX.supabase.co",
    SUPABASE_ANON_KEY: "XXXX",
};
