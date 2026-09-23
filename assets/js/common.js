// Helper yang dipakai bersama oleh semua halaman.
// Dimuat setelah config.js dan sebelum file di assets/js/pages/.

/**
 * Mengamankan teks sebelum dimasukkan ke innerHTML.
 * Wajib dipakai untuk semua data yang bisa diisi pengguna
 * (nama, kota, kategori, dsb.) agar tidak terjadi XSS.
 */
function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Pengaman halaman admin: hanya akun dengan profiles.role = 'admin' yang boleh masuk.
 * Membutuhkan supabase/01_admin_role.sql sudah dijalankan.
 *
 * Catatan: pengecekan di browser hanya untuk UX (menyembunyikan halaman).
 * Perlindungan data yang sebenarnya ada di RLS (supabase/02_rls_policies.sql).
 */
async function requireAdmin(client, loginPage = "../index.html") {
    const {
        data: { session },
    } = await client.auth.getSession();
    if (!session) {
        window.location.replace(loginPage);
        return null;
    }
    const { data: isAdmin, error } = await client.rpc("is_admin");
    if (error || isAdmin !== true) {
        document.body.innerHTML =
            '<div style="font-family:sans-serif;padding:3rem;text-align:center">' +
            "<h1>Akses ditolak</h1><p>Halaman ini khusus peneliti/admin.</p>" +
            '<p><a href="' + loginPage + '">Kembali ke beranda</a></p></div>';
        return null;
    }
    return session.user;
}

/**
 * Mengambil SEMUA baris dari sebuah query Supabase.
 * Supabase membatasi 1.000 baris per permintaan, sehingga data penelitian
 * yang lebih besar dari itu akan terpotong diam-diam tanpa fungsi ini.
 *
 * Pemakaian: await fetchAll(() => client.from("riwayat_kuis").select("*").order("id"))
 */
async function fetchAll(buatQuery, ukuranHalaman = 1000) {
    let semua = [];
    for (let dari = 0; ; dari += ukuranHalaman) {
        const { data, error } = await buatQuery().range(dari, dari + ukuranHalaman - 1);
        if (error) throw error;
        semua = semua.concat(data || []);
        if (!data || data.length < ukuranHalaman) break;
    }
    return semua;
}

/** Usia dalam tahun penuh pada tanggal acuan (default: hari ini). */
function hitungUsia(tanggalLahir, acuan = new Date()) {
    if (!tanggalLahir) return null;
    const lahir = new Date(tanggalLahir);
    if (isNaN(lahir)) return null;
    const ref = new Date(acuan);
    let usia = ref.getFullYear() - lahir.getFullYear();
    const bulan = ref.getMonth() - lahir.getMonth();
    if (bulan < 0 || (bulan === 0 && ref.getDate() < lahir.getDate())) usia--;
    return usia;
}

/** Gaya default Chart.js agar grafik mengikuti tipografi dan palet situs. */
function aturGayaGrafik() {
    Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#6B746F";
    Chart.defaults.borderColor = "#E1E4E2";
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = "#18201D";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.elements.arc.borderWidth = 0;
}
if (window.Chart) aturGayaGrafik();
