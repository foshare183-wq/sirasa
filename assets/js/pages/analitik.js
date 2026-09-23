// Logika halaman admin/analitik.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let chartInstances = {};
let globalMasterExportData = [];

let rawProfiles = [];
let rawRiwayat = [];
let rawBuku = [];
let filteredProfiles = [];
let filteredRiwayat = [];

const DIMENSI_LIST = ["Pengetahuan", "Efikasi Diri", "Sikap", "Aksesibilitas Media Digital", "Perilaku Pencegahan"];
const MAX_SCORE_TOTAL = 500; // Asumsi poin maksimal kuis jika dijumlah
const TAHUN_SEKARANG = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof CONFIG === "undefined") return alert("config.js tidak terbaca!");
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const admin = await requireAdmin(supabaseClient);
    if (!admin) return;
    await fetchSemuaDataMaster();
    terapkanFilter();
});

function switchAnaTab(tabId) {
    document.querySelectorAll(".tab-ana").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll('button[id^="btn-tab-"]').forEach((el) => {
        el.classList.remove("border-b-2", "border-indigo-600", "text-indigo-600");
        el.classList.add("text-slate-500");
    });
    document.getElementById(tabId).classList.add("active");
    document.getElementById("btn-" + tabId).classList.remove("text-slate-500");
    document.getElementById("btn-" + tabId).classList.add("border-b-2", "border-indigo-600", "text-indigo-600");

    if (tabId === "tab-global") renderTabGlobal();
    if (tabId === "tab-modul") renderTabModul();
    if (tabId === "tab-user") renderTabUser();
    if (tabId === "tab-item") bukaTabItem();
}

function hitungUmur(tglLahir) {
    return hitungUsia(tglLahir);
}

async function fetchSemuaDataMaster() {
    // fetchAll: ambil seluruh baris (tidak terpotong batas 1.000 baris Supabase)
    const [profil, buku, riwayat] = await Promise.all([
        fetchAll(() => supabaseClient.from("profiles").select("*").order("created_at", { ascending: false })),
        fetchAll(() => supabaseClient.from("buku").select("id, judul, tipe_konten, created_at").order("created_at")),
        fetchAll(() => supabaseClient.from("riwayat_kuis").select("*").order("created_at", { ascending: false })),
    ]);

    rawProfiles = profil;
    rawBuku = buku;
    rawRiwayat = riwayat;

    // Populate Dropdown Kota Global
    const ddKota = document.getElementById("filter-kota");
    const kotaUnik = [...new Set(rawProfiles.map((p) => p.kota).filter(Boolean))].sort();
    kotaUnik.forEach((k) => (ddKota.innerHTML += `<option value="${esc(k)}">${esc(k)}</option>`));

    // Populate Dropdown Modul
    const ddModul = document.getElementById("select-modul");
    rawBuku.forEach((b) => {
        if (b.tipe_konten !== "Pengantar Sistem")
            ddModul.innerHTML += `<option value="${b.id}">[${b.tipe_konten}] ${b.judul}</option>`;
    });
}

function terapkanFilter() {
    const fKota = document.getElementById("filter-kota").value;
    const fStart = document.getElementById("filter-start").value;
    const fEnd = document.getElementById("filter-end").value;

    // Filter Profil
    filteredProfiles = rawProfiles.filter((p) => fKota === "Semua" || p.kota === fKota);
    const validUserIds = new Set(filteredProfiles.map((p) => p.id));

    // Filter Riwayat
    filteredRiwayat = rawRiwayat.filter((r) => {
        if (!validUserIds.has(r.id_user)) return false;
        if (fStart || fEnd) {
            let d = new Date(r.created_at);
            d.setHours(0, 0, 0, 0);
            if (fStart && d < new Date(fStart).setHours(0, 0, 0, 0)) return false;
            if (fEnd && d > new Date(fEnd).setHours(23, 59, 59, 999)) return false;
        }
        return true;
    });

    // Refresh Dropdown User di Tab Responden
    const ddUser = document.getElementById("select-user");
    const currUser = ddUser.value;
    ddUser.innerHTML = '<option value="">-- Pilih Nama Responden --</option>';
    filteredProfiles.forEach(
        (u) => (ddUser.innerHTML += `<option value="${u.id}">${esc(u.nama_lengkap)} - ${esc(u.kategori || "")}</option>`),
    );
    if (filteredProfiles.some((p) => p.id === currUser)) ddUser.value = currUser;

    // Render ulang semua tampilan
    renderTabGlobal();
    renderTabModul();
    renderTabUser();
    if (typeof segarkanTabItem === "function") segarkanTabItem();
}

// ==========================================
// RENDER TAB 1: GLOBAL & MASTER SPSS
// ==========================================
function renderTabGlobal() {
    document.getElementById("g-populasi").innerText = filteredProfiles.length;
    document.getElementById("g-aktif").innerText = filteredProfiles.filter((p) => p.total_poin > 0).length;

    let genderCount = { "Laki-laki": 0, Perempuan: 0 };
    let catCount = { Pelajar: 0, Mahasiswa: 0, Umum: 0 };
    let ageCount = { "< 15 Thn": 0, "15-18 Thn": 0, "19-22 Thn": 0, "> 22 Thn": 0, Kosong: 0 };

    filteredProfiles.forEach((p) => {
        if (p.jenis_kelamin) genderCount[p.jenis_kelamin] = (genderCount[p.jenis_kelamin] || 0) + 1;
        if (p.kategori) catCount[p.kategori] = (catCount[p.kategori] || 0) + 1;

        let age = hitungUmur(p.tanggal_lahir);
        if (age !== null) {
            if (age < 15) ageCount["< 15 Thn"]++;
            else if (age <= 18) ageCount["15-18 Thn"]++;
            else if (age <= 22) ageCount["19-22 Thn"]++;
            else ageCount["> 22 Thn"]++;
        } else {
            ageCount["Kosong"]++;
        }
    });

    // 1. Chart Gender
    if (chartInstances.cGender) chartInstances.cGender.destroy();
    chartInstances.cGender = new Chart(document.getElementById("c-gender"), {
        type: "pie",
        data: {
            labels: Object.keys(genderCount),
            datasets: [{ data: Object.values(genderCount), backgroundColor: ["#1F665C", "#B93A3F"] }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });

    // 2. Chart Kategori
    if (chartInstances.cKat) chartInstances.cKat.destroy();
    chartInstances.cKat = new Chart(document.getElementById("c-kategori"), {
        type: "pie",
        data: {
            labels: Object.keys(catCount),
            datasets: [{ data: Object.values(catCount), backgroundColor: ["#1F665C", "#B9872C", "#99A19D"] }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
    });

    // 3. Chart Usia
    if (chartInstances.cU) chartInstances.cU.destroy();
    chartInstances.cU = new Chart(document.getElementById("c-usia"), {
        type: "bar",
        data: {
            labels: Object.keys(ageCount),
            datasets: [{ label: "Jumlah", data: Object.values(ageCount), backgroundColor: "#4E998C", borderRadius: 4 }],
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });

    // Papan Peringkat Top 5
    let top5 = [...filteredProfiles].sort((a, b) => (b.total_poin || 0) - (a.total_poin || 0)).slice(0, 5);
    let boardHtml = "";
    top5.forEach((u, i) => {
        let badge =
            i === 0
                ? '<i class="fa-solid fa-trophy text-yellow-500"></i>'
                : i === 1
                  ? '<i class="fa-solid fa-medal text-slate-400"></i>'
                  : i === 2
                    ? '<i class="fa-solid fa-medal text-amber-600"></i>'
                    : `<span class="text-xs font-bold text-slate-400">${i + 1}</span>`;
        boardHtml += `<div class="flex items-center justify-between p-2 bg-white rounded border border-slate-100 shadow-sm"><div class="flex items-center gap-3"><span class="w-6 text-center">${badge}</span><span class="font-bold text-sm text-slate-700 truncate w-24">${esc(u.nama_lengkap)}</span></div><span class="text-indigo-600 font-black text-sm">${u.total_poin || 0} Poin</span></div>`;
    });
    document.getElementById("wadah-leaderboard").innerHTML = boardHtml;

    // PROSES DATA RIWAYAT (WAKTU, PRE/POST, N-GAIN)
    let kamusBuku = {};
    rawBuku.forEach((b) => (kamusBuku[b.id] = b));
    let userRecord = {};

    filteredProfiles.forEach((p) => {
        userRecord[p.id] = {
            id: p.id,
            nama: p.nama_lengkap,
            gender: p.jenis_kelamin || "-",
            usia: hitungUmur(p.tanggal_lahir) || "-",
            kategori: p.kategori || "-",
            kota: p.kota || "-",
            pre: {},
            post: {},
            baca: {},
            kuis: {},
        };
    });

    let totalWaktuDetik = 0;
    let totPre = [0, 0, 0, 0, 0];
    let cntPre = [0, 0, 0, 0, 0];
    let totPost = [0, 0, 0, 0, 0];
    let cntPost = [0, 0, 0, 0, 0];
    let countDaftar = filteredProfiles.length;
    let countPreAktif = 0;
    let countBacaAktif = 0;
    let countPostAktif = 0;

    let totalNGainValid = 0;
    let countNGainValid = 0;
    let ngainDist = { Tinggi: 0, Sedang: 0, Rendah: 0 };

    filteredRiwayat.forEach((r) => {
        if (!userRecord[r.id_user]) return;
        const b = kamusBuku[r.id_buku] || { judul: "Unknown", tipe: "Umum" };
        const dur = r.durasi_baca_detik || 0;
        const scr = r.poin_didapat || 0;
        const dim = r.dimensi || "Umum";

        totalWaktuDetik += dur;
        if (r.jenis_tes === "Membaca Modul PDF") {
            userRecord[r.id_user].baca[b.judul] = (userRecord[r.id_user].baca[b.judul] || 0) + dur;
        } else {
            if (b.tipe_konten === "Evaluasi Global") {
                let idx = DIMENSI_LIST.indexOf(dim);
                if (b.judul.toLowerCase().includes("pre")) {
                    userRecord[r.id_user].pre[dim] = scr;
                    if (idx > -1) {
                        totPre[idx] += scr;
                        cntPre[idx]++;
                    }
                } else {
                    userRecord[r.id_user].post[dim] = scr;
                    if (idx > -1) {
                        totPost[idx] += scr;
                        cntPost[idx]++;
                    }
                }
            } else {
                userRecord[r.id_user].kuis[b.judul] = (userRecord[r.id_user].kuis[b.judul] || 0) + dur;
            }
        }
    });

    document.getElementById("g-waktu").innerText = Math.floor(totalWaktuDetik / 3600) + " Jam";

    globalMasterExportData = [];
    const arrBaca = Array.from(
        new Set(rawBuku.filter((b) => b.tipe_konten === "Modul PDF").map((b) => b.judul)),
    ).sort();
    const arrKuis = Array.from(
        new Set(rawBuku.filter((b) => b.tipe_konten === "Hanya Kuis").map((b) => b.judul)),
    ).sort();

    let hd = `<th class="py-3 px-5 border-r sticky left-0 bg-slate-100 z-10">Nama Responden</th><th class="py-3 px-5 border-r">Kategori</th><th class="py-3 px-5 border-r">Usia</th><th class="py-3 px-5 border-r">Gender</th><th class="py-3 px-5 border-r">Kota</th><th class="py-3 px-5 border-r">N-Gain Total</th>`;
    arrBaca.forEach((m) => (hd += `<th class="py-3 px-5 bg-indigo-50 border-r">Durasi [M]: ${m} (s)</th>`));
    arrKuis.forEach((m) => (hd += `<th class="py-3 px-5 bg-amber-50 border-r">Durasi [K]: ${m} (s)</th>`));
    DIMENSI_LIST.forEach(
        (d) =>
            (hd += `<th class="py-3 px-5 bg-emerald-50 border-r">Pre: ${d}</th><th class="py-3 px-5 bg-emerald-50 border-r">Post: ${d}</th><th class="py-3 px-5 bg-emerald-100 border-r">Gain: ${d}</th>`),
    );
    document.getElementById("headMasterData").innerHTML = `<tr>${hd}</tr>`;

    const tbody = document.getElementById("tabelMasterData");
    tbody.innerHTML = "";

    Object.values(userRecord).forEach((u) => {
        let rX = { ID: u.id, Nama: u.nama, Kategori: u.kategori, Usia: u.usia, Gender: u.gender, Kota: u.kota };
        let tHtml = `<td class="py-3 px-5 font-bold sticky left-0 bg-white z-10 border-r whitespace-nowrap">${esc(u.nama)}</td><td class="py-3 px-5 border-r">${esc(u.kategori)}</td><td class="py-3 px-5 border-r text-center">${u.usia}</td><td class="py-3 px-5 border-r">${esc(u.gender)}</td><td class="py-3 px-5 border-r">${esc(u.kota)}</td>`;

        if (Object.keys(u.pre).length > 0) countPreAktif++;
        if (Object.values(u.baca).some((v) => v > 0)) countBacaAktif++;
        if (Object.keys(u.post).length > 0) countPostAktif++;

        let totalPre = 0;
        let totalPost = 0;
        let testHtml = "";

        arrBaca.forEach((m) => {
            rX[`Durasi_Modul_${m}`] = u.baca[m] || 0;
        });
        arrKuis.forEach((m) => {
            rX[`Durasi_Kuis_${m}`] = u.kuis[m] || 0;
        });

        DIMENSI_LIST.forEach((d) => {
            let preVal = u.pre[d] !== undefined ? u.pre[d] : null;
            let postVal = u.post[d] !== undefined ? u.post[d] : null;
            rX[`Pre_${d}`] = preVal !== null ? preVal : "";
            rX[`Post_${d}`] = postVal !== null ? postVal : "";
            totalPre += preVal || 0;
            totalPost += postVal || 0;
            let gain = preVal !== null && postVal !== null ? postVal - preVal : null;
            rX[`Gain_${d}`] = gain !== null ? gain : "";
            testHtml += `<td class="py-3 px-5 border-r text-center">${preVal !== null ? preVal : "-"}</td><td class="py-3 px-5 border-r text-center">${postVal !== null ? postVal : "-"}</td><td class="py-3 px-5 border-r font-bold text-center">${gain !== null ? gain : "-"}</td>`;
        });

        let nGain = null;
        if (totalPre > 0 && totalPost > 0 && totalPost > totalPre) {
            nGain = (totalPost - totalPre) / (MAX_SCORE_TOTAL - totalPre);
            totalNGainValid += nGain;
            countNGainValid++;
            if (nGain >= 0.7) ngainDist.Tinggi++;
            else if (nGain >= 0.3) ngainDist.Sedang++;
            else ngainDist.Rendah++;
        }
        rX["NGain_Total"] = nGain !== null ? nGain.toFixed(2) : "";
        tHtml += `<td class="py-3 px-5 font-black text-indigo-600 border-r bg-indigo-50/30 text-center">${nGain !== null ? nGain.toFixed(2) : "-"}</td>`;

        arrBaca.forEach((m) => (tHtml += `<td class="py-3 px-5 border-r text-center">${u.baca[m] || 0}</td>`));
        arrKuis.forEach((m) => (tHtml += `<td class="py-3 px-5 border-r text-center">${u.kuis[m] || 0}</td>`));
        tHtml += testHtml;

        tbody.innerHTML += `<tr class="hover:bg-slate-50 border-b">${tHtml}</tr>`;
        globalMasterExportData.push(rX);
    });

    document.getElementById("g-ngain").innerText =
        countNGainValid > 0 ? (totalNGainValid / countNGainValid).toFixed(2) : "0.00";

    // 4. Chart Tren Garis Global
    let avgPre = totPre.map((v, i) => (cntPre[i] ? (v / cntPre[i]).toFixed(1) : 0));
    let avgPost = totPost.map((v, i) => (cntPost[i] ? (v / cntPost[i]).toFixed(1) : 0));
    if (chartInstances.cTrend) chartInstances.cTrend.destroy();
    chartInstances.cTrend = new Chart(document.getElementById("c-trend-global"), {
        type: "line",
        data: {
            labels: DIMENSI_LIST,
            datasets: [
                { label: "Pre-Test", data: avgPre, borderColor: "#B9872C", fill: false, tension: 0.3 },
                { label: "Post-Test", data: avgPost, borderColor: "#1F665C", fill: false, tension: 0.3 },
            ],
        },
        options: { maintainAspectRatio: false },
    });

    // 5. Chart Radar Global
    if (chartInstances.cRadarG) chartInstances.cRadarG.destroy();
    chartInstances.cRadarG = new Chart(document.getElementById("c-radar-global"), {
        type: "radar",
        data: {
            labels: DIMENSI_LIST,
            datasets: [
                { label: "Pre-Test", data: avgPre, borderColor: "#B9872C", backgroundColor: "rgba(185, 135, 44, 0.15)" },
                {
                    label: "Post-Test",
                    data: avgPost,
                    borderColor: "#1F665C",
                    backgroundColor: "rgba(31, 102, 92, 0.15)",
                },
            ],
        },
        options: { maintainAspectRatio: false },
    });

    // 6. Chart N-Gain Distribusi (Doughnut)
    if (chartInstances.cNGainPie) chartInstances.cNGainPie.destroy();
    chartInstances.cNGainPie = new Chart(document.getElementById("c-ngain-pie"), {
        type: "doughnut",
        data: {
            labels: ["Tinggi (≥ 0.7)", "Sedang", "Rendah (< 0.3)"],
            datasets: [
                {
                    data: [ngainDist.Tinggi, ngainDist.Sedang, ngainDist.Rendah],
                    backgroundColor: ["#1F665C", "#B9872C", "#B93A3F"],
                },
            ],
        },
        options: { maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom" } } },
    });

    // 7. Funnel Retensi
    if (chartInstances.cFunnel) chartInstances.cFunnel.destroy();
    chartInstances.cFunnel = new Chart(document.getElementById("c-funnel-global"), {
        type: "bar",
        data: {
            labels: ["Pendaftar", "Mulai Pre-Test", "Akses Modul", "Selesai Post-Test"],
            datasets: [
                {
                    label: "Jumlah User",
                    data: [countDaftar, countPreAktif, countBacaAktif, countPostAktif],
                    backgroundColor: ["#C9CECB", "#99A19D", "#4E998C", "#1F665C"],
                    borderRadius: 4,
                },
            ],
        },
        options: { maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } } },
    });
}

// ==========================================
// RENDER TAB 2: PER MODUL
// ==========================================
function renderTabModul() {
    const idModul = document.getElementById("select-modul").value;
    const wChart = document.getElementById("wadah-analisis-modul");

    if (!idModul) {
        document.getElementById("m-interaksi").innerText = "0";
        document.getElementById("m-waktu").innerText = "0s";
        document.getElementById("m-skor").innerText = "-";
        wChart.classList.add("hidden");
        return;
    }
    wChart.classList.remove("hidden");

    const riwayatModul = filteredRiwayat.filter((r) => r.id_buku === idModul);
    const buku = rawBuku.find((b) => b.id === idModul);

    const userUnique = new Set(riwayatModul.map((r) => r.id_user));
    let totalWaktu = 0;
    let scores = [];

    riwayatModul.forEach((r) => {
        totalWaktu += r.durasi_baca_detik || 0;
        if (buku && buku.tipe_konten !== "Modul PDF") scores.push(r.poin_didapat || 0);
    });

    document.getElementById("m-interaksi").innerText = userUnique.size;
    document.getElementById("m-waktu").innerText =
        userUnique.size > 0 ? Math.round(totalWaktu / userUnique.size) + "s" : "0s";

    if (buku && buku.tipe_konten !== "Modul PDF") {
        let avgSkor = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        document.getElementById("m-skor").innerText = avgSkor;

        let rentang = { "0-40": 0, "41-70": 0, "71-100": 0 };
        scores.forEach((s) => {
            if (s <= 40) rentang["0-40"]++;
            else if (s <= 70) rentang["41-70"]++;
            else rentang["71-100"]++;
        });

        if (chartInstances.cDistModul) chartInstances.cDistModul.destroy();
        chartInstances.cDistModul = new Chart(document.getElementById("c-distribusi-modul"), {
            type: "bar",
            data: {
                labels: Object.keys(rentang),
                datasets: [
                    {
                        label: "Jumlah Responden",
                        data: Object.values(rentang),
                        backgroundColor: "#1F665C",
                        borderRadius: 4,
                    },
                ],
            },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
    } else {
        document.getElementById("m-skor").innerText = "N/A";
        let waktuMap = { "< 30s": 0, "31-60s": 0, "> 60s": 0 };
        riwayatModul.forEach((r) => {
            let d = r.durasi_baca_detik || 0;
            if (d <= 30) waktuMap["< 30s"]++;
            else if (d <= 60) waktuMap["31-60s"]++;
            else waktuMap["> 60s"]++;
        });

        if (chartInstances.cDistModul) chartInstances.cDistModul.destroy();
        chartInstances.cDistModul = new Chart(document.getElementById("c-distribusi-modul"), {
            type: "bar",
            data: {
                labels: Object.keys(waktuMap),
                datasets: [
                    {
                        label: "Jumlah Responden",
                        data: Object.values(waktuMap),
                        backgroundColor: "#4E998C",
                        borderRadius: 4,
                    },
                ],
            },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
    }
}

// ==========================================
// RENDER TAB 3: PER RESPONDEN
// ==========================================
function renderTabUser() {
    const idUser = document.getElementById("select-user").value;
    const wTimeline = document.getElementById("wadah-timeline-user");

    if (!idUser) {
        wTimeline.innerHTML = '<p class="text-sm text-slate-400 italic">Pilih responden untuk melihat histori.</p>';
        if (chartInstances.cRadarI) chartInstances.cRadarI.destroy();
        return;
    }

    const user = filteredProfiles.find((u) => u.id === idUser);
    if (!user) return;

    document.getElementById("u-ava").innerHTML = '<i class="fa-solid fa-user"></i>';
    document.getElementById("u-nama").innerText = user.nama_lengkap;

    let usia = hitungUmur(user.tanggal_lahir);
    document.getElementById("u-bio").innerText =
        `${user.kategori || "Kategori N/A"} | ${user.jenis_kelamin || "Gender N/A"} | ${usia !== null ? usia + " Tahun" : "Usia N/A"}`;
    document.getElementById("u-lokasi").innerHTML =
        `<i class="fa-solid fa-location-dot"></i> ${esc(user.kota || "Kota N/A")}`;
    document.getElementById("u-poin").innerText = user.total_poin || 0;

    const riwayatUser = filteredRiwayat.filter((r) => r.id_user === idUser);
    let preData = [0, 0, 0, 0, 0];
    let postData = [0, 0, 0, 0, 0];
    let totPre = 0;
    let totPost = 0;
    let kamusBuku = {};
    rawBuku.forEach((b) => (kamusBuku[b.id] = b));

    wTimeline.innerHTML = "";
    if (riwayatUser.length === 0)
        wTimeline.innerHTML = '<p class="text-sm text-slate-500">Belum ada aktivitas terekam.</p>';

    riwayatUser.forEach((r) => {
        const b = kamusBuku[r.id_buku] || { judul: "Konten Dihapus", tipe_konten: "Unknown" };

        if (b.tipe_konten === "Evaluasi Global") {
            let idx = DIMENSI_LIST.indexOf(r.dimensi);
            if (idx !== -1) {
                if (b.judul.toLowerCase().includes("pre")) {
                    preData[idx] = r.poin_didapat;
                    totPre += r.poin_didapat;
                } else {
                    postData[idx] = r.poin_didapat;
                    totPost += r.poin_didapat;
                }
            }
        }

        let dt = new Date(r.created_at);
        let timeStr =
            dt.toLocaleDateString("id-ID") +
            " " +
            dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        let iconT =
            b.tipe_konten === "Modul PDF"
                ? '<i class="fa-solid fa-file-pdf text-rose-500"></i>'
                : '<i class="fa-solid fa-pen-to-square text-indigo-500"></i>';
        let aksi =
            b.tipe_konten === "Modul PDF"
                ? `Membaca selama ${r.durasi_baca_detik} detik`
                : `Mendapat skor ${r.poin_didapat} poin`;

        wTimeline.innerHTML += `<div class="relative pl-6"><div class="absolute -left-[5px] top-1 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white"></div><p class="text-[10px] font-bold text-slate-400 mb-0.5">${timeStr}</p><p class="text-sm font-bold text-slate-700">${iconT} ${b.judul}</p><p class="text-xs text-slate-500">${aksi}</p></div>`;
    });

    let nGain = "-";
    if (totPre > 0 && totPost > 0 && totPost > totPre) {
        nGain = ((totPost - totPre) / (MAX_SCORE_TOTAL - totPre)).toFixed(2);
    }
    document.getElementById("u-ngain").innerText = nGain;

    if (chartInstances.cRadarI) chartInstances.cRadarI.destroy();
    chartInstances.cRadarI = new Chart(document.getElementById("c-radar-individu"), {
        type: "radar",
        data: {
            labels: DIMENSI_LIST,
            datasets: [
                {
                    label: "Skor Pre-Test",
                    data: preData,
                    borderColor: "#B9872C",
                    backgroundColor: "rgba(185, 135, 44, 0.15)",
                },
                {
                    label: "Skor Post-Test",
                    data: postData,
                    borderColor: "#1F665C",
                    backgroundColor: "rgba(31, 102, 92, 0.15)",
                },
            ],
        },
        options: { maintainAspectRatio: false, scales: { r: { suggestedMin: 0, suggestedMax: 100 } } },
    });
}

function exportMasterExcel() {
    if (!globalMasterExportData.length) return alert("Tidak ada data untuk diekspor!");
    const ws = XLSX.utils.json_to_sheet(globalMasterExportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SPSS_Master_Data");
    XLSX.writeFile(wb, "KITA_SEBAYA_SPSS_Export.xlsx");
}
