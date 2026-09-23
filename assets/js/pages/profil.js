// Logika halaman profil.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let loggedInUser = null;
let chartInstances = {};

try {
    if (typeof CONFIG === "undefined") throw new Error("config.js tidak terbaca!");
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    inisialisasiProfil();
} catch (err) {
    console.error("Error inisialisasi:", err);
}

async function inisialisasiProfil() {
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }
    loggedInUser = session.user;
    document.getElementById("input-email").value = loggedInUser.email;
    document.getElementById("teks-email").innerText = loggedInUser.email;

    await loadDataProfil();
    await loadDataAnalitik();
}

async function loadDataProfil() {
    try {
        const { data: profil, error } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", loggedInUser.id)
            .single();
        if (error) throw error;

        // Set Teks Header (Kartu Profil)
        document.getElementById("teks-nama").innerText = profil.nama_lengkap;
        document.getElementById("teks-kategori").innerText = profil.kategori;
        document.getElementById("teks-gender").innerText = profil.jenis_kelamin;
        document.getElementById("avatar-inisial").innerText = profil.nama_lengkap.charAt(0).toUpperCase();
        const usia = hitungUsia(profil.tanggal_lahir);
        document.getElementById("teks-usia").innerText = usia !== null ? `${usia} tahun` : "Tanggal lahir belum diisi";

        // Set Data di Modal Edit
        document.getElementById("input-nama").value = profil.nama_lengkap;
        document.getElementById("input-kategori").value = profil.kategori;
        document.getElementById("input-gender").value = profil.jenis_kelamin;
        document.getElementById("input-tgl-lahir").value = profil.tanggal_lahir || "";

        // Set Quick Stat Total XP
        document.getElementById("stat-xp").innerText = (profil.total_poin || 0).toLocaleString("id-ID");
    } catch (e) {
        console.error("Gagal load profil:", e);
    }
}

// ==========================================
// FUNGSI MODAL EDIT PROFIL
// ==========================================
function bukaModalEdit() {
    document.getElementById("modalEditProfil").classList.remove("hidden");
}

function tutupModalEdit() {
    document.getElementById("modalEditProfil").classList.add("hidden");
}

window.addEventListener("click", function (event) {
    const modal = document.getElementById("modalEditProfil");
    if (event.target === modal) tutupModalEdit();
});

async function simpanProfil(btn) {
    const nama = document.getElementById("input-nama").value;
    const kategori = document.getElementById("input-kategori").value;
    const gender = document.getElementById("input-gender").value;
    const tglLahir = document.getElementById("input-tgl-lahir").value;

    if (!nama.trim()) return alert("Nama tidak boleh kosong.");
    if (!tglLahir) return alert("Tanggal lahir wajib diisi.");
    const usia = hitungUsia(tglLahir);
    if (usia === null || usia < 10 || usia > 90) return alert("Tanggal lahir belum sesuai. Periksa kembali tahun lahirmu.");

    btn.disabled = true;
    btn.innerHTML = "Menyimpan…";
    try {
        const { error } = await supabaseClient
            .from("profiles")
            .update({ nama_lengkap: nama.trim(), kategori: kategori, jenis_kelamin: gender, tanggal_lahir: tglLahir })
            .eq("id", loggedInUser.id);
        if (error) throw error;
        loadDataProfil();
        tutupModalEdit(); // Modal otomatis tertutup saat sukses
    } catch (e) {
        alert("Profil belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Simpan perubahan";
    }
}

// ==========================================
// SISTEM GRAFIK & ANALITIK PRIBADI
// ==========================================
async function loadDataAnalitik() {
    try {
        const { data: riwayat } = await supabaseClient
            .from("riwayat_kuis")
            .select("*, buku(judul, tipe_konten)")
            .eq("id_user", loggedInUser.id)
            .order("created_at", { ascending: false });

        if (!riwayat || riwayat.length === 0) {
            document.getElementById("pesan-kosong-prepost").classList.remove("hidden");
            return;
        }

        // --- 1. Kalkulasi Statistik Cepat ---
        let totalDurasiDetik = 0;
        let totalSkor = 0;

        riwayat.forEach((r) => {
            totalDurasiDetik += r.durasi_baca_detik || 0;
            totalSkor += r.poin_didapat || 0;
        });

        document.getElementById("stat-tes").innerText = riwayat.length;
        document.getElementById("stat-waktu").innerText = Math.round(totalDurasiDetik / 60) + "m";
        document.getElementById("stat-akurasi").innerText = Math.round(totalSkor / riwayat.length);

        // --- 2. Data Tren N-Gain (EKSKLUSIF UNTUK PRE-TEST VS POST-TEST) ---
        const mapTrend = {};

        riwayat.forEach((r) => {
            const judulAsli = r.buku ? r.buku.judul : "";
            if (!judulAsli) return;

            // STRICT FILTER: Hanya proses modul yang judulnya mengandung kata 'Pre-Test' atau 'Post-Test'
            const isPaketPrePost =
                judulAsli.toLowerCase().includes("pre-test") || judulAsli.toLowerCase().includes("post-test");

            if (isPaketPrePost) {
                const topikDasar = judulAsli.replace(/^(Pre-Test:\s*|Post-Test:\s*)/i, "").trim();

                // Buat wadah penampung sementara jika topik ini baru muncul
                if (!mapTrend[topikDasar]) mapTrend[topikDasar] = { pre: null, post: null };

                if (judulAsli.toLowerCase().includes("pre-test")) {
                    mapTrend[topikDasar].pre = r.poin_didapat || 0;
                } else if (judulAsli.toLowerCase().includes("post-test")) {
                    mapTrend[topikDasar].post = r.poin_didapat || 0;
                }
            }
            // Abaikan modul mandiri/evaluasi biasa, biarkan mereka lenyap dari grafik ini!
        });

        // Tarik hanya topik yang valid (Setidaknya ada data pre atau post)
        const validTopics = Object.keys(mapTrend).filter((k) => mapTrend[k].pre !== null || mapTrend[k].post !== null);

        const dataPre = validTopics.map((k) => (mapTrend[k].pre !== null ? mapTrend[k].pre : 0));
        const dataPost = validTopics.map((k) => (mapTrend[k].post !== null ? mapTrend[k].post : 0));

        if (validTopics.length === 0) {
            document.getElementById("pesan-kosong-prepost").classList.remove("hidden");
        } else {
            document.getElementById("pesan-kosong-prepost").classList.add("hidden");
            if (chartInstances["prepost"]) chartInstances["prepost"].destroy();

            chartInstances["prepost"] = new Chart(document.getElementById("chartPrePost").getContext("2d"), {
                type: "bar",
                data: {
                    labels: validTopics.map((l) => (l.length > 20 ? l.substring(0, 20) + "..." : l)),
                    datasets: [
                        { label: "Nilai Pre-Test", data: dataPre, backgroundColor: "#B9872C", borderRadius: 6 },
                        { label: "Nilai Post-Test", data: dataPost, backgroundColor: "#1F665C", borderRadius: 6 },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, title: { display: true, text: "Poin XP" } } },
                    plugins: { legend: { position: "bottom" } },
                },
            });
        }

        // --- 3. Data Tren Aktivitas (7 Hari Terakhir) - Menggabungkan semua XP dan Waktu ---
        const trendLabels = [];
        const trendXP = [];
        const trendDurasiMenit = [];

        const hariIni = new Date();
        for (let i = 6; i >= 0; i--) {
            let d = new Date(hariIni);
            d.setDate(d.getDate() - i);
            trendLabels.push(d.toLocaleDateString("id-ID", { weekday: "short" }));
            trendXP.push(0);
            trendDurasiMenit.push(0);
        }

        riwayat.forEach((r) => {
            if (r.created_at) {
                let rDate = new Date(r.created_at);
                let diffDays = Math.floor((hariIni - rDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays < 7) {
                    let index = 6 - diffDays;
                    // XP dan Durasi dari SEMUA modul (termasuk modul biasa) masuk ke sini
                    trendXP[index] += r.poin_didapat || 0;
                    trendDurasiMenit[index] += (r.durasi_baca_detik || 0) / 60;
                }
            }
        });

        if (chartInstances["aktivitas"]) chartInstances["aktivitas"].destroy();
        chartInstances["aktivitas"] = new Chart(document.getElementById("chartAktivitas").getContext("2d"), {
            type: "line",
            data: {
                labels: trendLabels,
                datasets: [
                    {
                        label: "Total XP Didapat",
                        data: trendXP,
                        borderColor: "#B93A3F",
                        backgroundColor: "rgba(185, 58, 63, 0.08)",
                        fill: true,
                        tension: 0.4,
                        yAxisID: "y",
                    },
                    {
                        label: "Durasi (Menit)",
                        data: trendDurasiMenit.map((d) => Math.round(d)),
                        borderColor: "#1F665C",
                        backgroundColor: "transparent",
                        borderDash: [5, 5],
                        tension: 0.4,
                        yAxisID: "y1",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                scales: {
                    y: { type: "linear", display: true, position: "left", title: { display: true, text: "XP" } },
                    y1: {
                        type: "linear",
                        display: true,
                        position: "right",
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: "Menit" },
                        suggestedMax: 10,
                    },
                },
                plugins: { legend: { position: "bottom" } },
            },
        });
    } catch (err) {
        console.error("Gagal load analitik:", err);
    }
}
