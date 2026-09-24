// Supabase Edge Function: admin-update-user
// Menggantikan endpoint Google Apps Script lama.
//
// Bedanya: fungsi ini MEMVERIFIKASI bahwa pemanggil sedang login sebagai admin
// sebelum memakai service_role key. Service role key tidak pernah keluar dari
// server Supabase (otomatis tersedia sebagai environment variable).
//
// Deploy: Supabase Dashboard > Edge Functions > Deploy a new function >
//         nama "admin-update-user", tempel isi file ini.
//         Atau via CLI: supabase functions deploy admin-update-user

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://kitasebaya.biz.id";

const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method tidak diizinkan" }, 405);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Pastikan pemanggil adalah admin (memakai token login pemanggil)
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_admin");
    if (adminErr || isAdmin !== true) return json({ error: "Hanya admin yang boleh melakukan ini" }, 403);

    // 2. Validasi input
    let payload: { id?: string; updates?: { email?: string; password?: string } };
    try {
        payload = await req.json();
    } catch {
        return json({ error: "Body tidak valid" }, 400);
    }

    const id = payload.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "ID pengguna tidak valid" }, 400);

    const updates: { email?: string; password?: string; email_confirm?: boolean } = {};
    const email = payload.updates?.email?.trim();
    const password = payload.updates?.password;

    if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Format email tidak valid" }, 400);
        updates.email = email;
        updates.email_confirm = true;
    }
    if (password) {
        if (password.length < 8) return json({ error: "Password minimal 8 karakter" }, 400);
        updates.password = password;
    }
    if (!updates.email && !updates.password) return json({ error: "Tidak ada perubahan" }, 400);

    // 3. Baru di sini service role dipakai
    const adminClient = createClient(url, serviceKey);
    const { error } = await adminClient.auth.admin.updateUserById(id, updates);
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
});
