// Logika halaman admin/index.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let chartInstances = {};
let draftKuisArray = [];
let dbBukuList = [];
let globalMasterExportData = [];
let introSlideId = null; // Tambahan Variabel untuk Pengaturan Intro

const LABELS = ["A", "B", "C", "D", "E"];
const DIMENSI_LIST = ["Pengetahuan", "Efikasi Diri", "Sikap", "Aksesibilitas Media Digital", "Perilaku Pencegahan"];
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

document.addEventListener("DOMContentLoaded", () => {
    if (typeof CONFIG === "undefined") return alert("config.js tidak terbaca!");
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    requireAdmin(supabaseClient).then((admin) => {
        if (admin) inisialisasiAdmin();
    });
});

// TAMBAHAN: Eksekusi fetchPengaturan
async function inisialisasiAdmin() {
    await fetchPengguna();
    await fetchDaftarBukuAdmin();
    await fetchDaftarKuis();
    await fetchPengaturan();
}

function toggleSidebar() {
    const sb = document.getElementById("sidebar");
    sb.classList.toggle("-translate-x-full");
    sb.classList.toggle("md:w-0");
    sb.classList.toggle("md:w-64");
}
function switchTab(t) {
    document.querySelectorAll(".tab-content").forEach((e) => e.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach((el) => {
        el.classList.remove("bg-rose-600", "text-white");
        el.classList.add("text-slate-300");
    });
    document.getElementById(t).classList.add("active");
    document.getElementById("nav-" + t).classList.add("bg-rose-600", "text-white");
}
function tutupModal(id) {
    document.getElementById(id).classList.add("hidden");
}

// ===================================
// 1. MANAJEMEN PENGGUNA (EDIT DIPERBARUI)
// ===================================
async function fetchPengguna() {
    const data = await fetchAll(() =>
        supabaseClient.from("profiles").select("*").order("created_at", { ascending: false }),
    );
    const tbody = document.getElementById("tabelPengguna");

    // Bersihkan isi tabel
    tbody.innerHTML = "";

    if (!data) return;

    data.forEach((u) => {
        const ava = `<div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs mr-3">${esc((u.nama_lengkap || "U").charAt(0))}</div>`;
        tbody.innerHTML += `
                <tr class="border-b">
                    <td class="py-3 px-6 flex items-center">${ava} ${esc(u.nama_lengkap)}</td>
                    <td class="py-3 px-6">${esc(u.kategori)}</td>
                    <td class="py-3 px-6">${esc(u.jenis_kelamin)}</td>
                    <td class="py-3 px-6">${esc(u.kota || "-")}</td>
                    <td class="py-3 px-6 text-center">
                        <button onclick="bukaModalDetailUser('${encodeURIComponent(JSON.stringify(u))}')" class="text-blue-500 bg-blue-50 p-2 rounded mr-1"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="hapusUser('${u.id}')" class="text-red-500 bg-red-50 p-2 rounded"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
    });
}

function bukaModalDetailUser(str) {
    const u = JSON.parse(decodeURIComponent(str));
    document.getElementById("edit-user-id").value = u.id;
    document.getElementById("edit-user-nama").value = u.nama_lengkap;
    document.getElementById("edit-user-kategori").value = u.kategori;
    document.getElementById("edit-user-gender").value = u.jenis_kelamin;
    document.getElementById("edit-user-kota").value = u.kota;
    document.getElementById("edit-user-tgl-lahir").value = u.tanggal_lahir || "";
    document.getElementById("edit-user-poin").value = u.total_poin || 0;

    // Kosongkan form kredensial tiap kali modal dibuka
    document.getElementById("edit-user-email").value = "";
    document.getElementById("edit-user-password").value = "";

    document.getElementById("modalDetailUser").classList.remove("hidden");
}

// TAMBAHAN UPDATE KREDENSIAL AUTH
async function simpanEditUser() {
    const id = document.getElementById("edit-user-id").value;
    const emailBaru = document.getElementById("edit-user-email").value;
    const passwordBaru = document.getElementById("edit-user-password").value;
    const btn = document.querySelector("#modalDetailUser button.bg-blue-600");
    const teksAsli = btn.innerHTML;

    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Memproses...";
    btn.disabled = true;

    try {
        // 1. Update Profile Tabel Publik (Tetap pakai Anon Key)
        await supabaseClient
            .from("profiles")
            .update({
                nama_lengkap: document.getElementById("edit-user-nama").value,
                kategori: document.getElementById("edit-user-kategori").value,
                jenis_kelamin: document.getElementById("edit-user-gender").value,
                kota: document.getElementById("edit-user-kota").value,
            tanggal_lahir: document.getElementById("edit-user-tgl-lahir").value || null,
                total_poin: parseInt(document.getElementById("edit-user-poin").value) || 0,
            })
            .eq("id", id);

        // 2. Update Auth via Google Apps Script (Hanya Eksekusi Jika Form Email/Pass Diisi)
        if (emailBaru || passwordBaru) {
            let updates = {};
            if (emailBaru) updates.email = emailBaru;
            if (passwordBaru) updates.password = passwordBaru;

            // Diproses oleh Supabase Edge Function yang memverifikasi bahwa pemanggil adalah admin.
            // Lihat supabase/functions/admin-update-user/index.ts
            // (menggantikan endpoint Google Apps Script lama yang bisa dipanggil siapa saja).
            const { data: result, error: fnError } = await supabaseClient.functions.invoke("admin-update-user", {
                body: { id: id, updates: updates },
            });

            if (fnError || (result && result.error)) {
                alert(
                    "Data profil tersimpan, namun gagal ubah kredensial: " +
                        ((result && result.error) || (fnError && fnError.message) || "Error Supabase"),
                );
            }
        }

        tutupModal("modalDetailUser");
        fetchPengguna();
    } catch (err) {
        alert("Terjadi kesalahan: " + err.message);
    } finally {
        btn.innerHTML = teksAsli;
        btn.disabled = false;
    }
}
async function hapusUser(id) {
    if (confirm("Hapus pengguna ini beserta datanya?")) {
        await supabaseClient.from("profiles").delete().eq("id", id);
        fetchPengguna();
    }
}

// ===================================
// 2. MANAJEMEN PENGATURAN INTRO SYSTEM (FITUR BARU)
// ===================================
async function fetchPengaturan() {
    const { data } = await supabaseClient.from("buku").select("*").eq("tipe_konten", "Pengantar Sistem").maybeSingle();
    const wadah = document.getElementById("wadah-edit-slides");
    wadah.innerHTML = "";

    let slides = [
        {
            judul: "Pahami Virusnya, Jauhi Penyakitnya",
            desc: "Tinggalkan cara belajar yang membosankan. Platform KITA SEBAYA menyajikan materi dengan modul interaktif yang menyenangkan.",
        },
        {
            judul: "Kerjakan Pre-Test & Post-Test",
            desc: "Ukur seberapa jauh pemahaman Anda sebelum dan sesudah membaca modul yang disediakan.",
        },
        {
            judul: "Sistem Peringkat & Gamifikasi",
            desc: "Setiap evaluasi yang berhasil Anda kerjakan dengan baik akan diakumulasi menjadi poin. Raih peringkat teratas!",
        },
    ];

    if (data) {
        introSlideId = data.id;
        setToggleUI(data.is_active);
        try {
            if (data.deskripsi) slides = JSON.parse(data.deskripsi);
        } catch (e) {}
    } else {
        const { data: newData } = await supabaseClient
            .from("buku")
            .insert([
                {
                    judul: "Pengaturan Slide Intro Aplikasi",
                    tipe_konten: "Pengantar Sistem",
                    is_active: true,
                    deskripsi: JSON.stringify(slides),
                },
            ])
            .select()
            .single();
        if (newData) {
            introSlideId = newData.id;
            setToggleUI(newData.is_active);
        }
    }

    slides.forEach((s, i) => {
        wadah.innerHTML += `
                <div class="border border-slate-200 p-4 rounded-xl bg-slate-50 relative">
                    <div class="absolute -top-3 left-4 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">Slide ${i + 1}</div>
                    <div class="mt-2">
                        <label class="block text-xs font-bold text-slate-500 mb-1">Judul Utama</label>
                        <input type="text" id="intro-judul-${i}" class="w-full p-2.5 border border-slate-300 rounded-lg mb-3" value="${s.judul}">
                        <label class="block text-xs font-bold text-slate-500 mb-1">Deskripsi Tambahan</label>
                        <textarea id="intro-desc-${i}" class="w-full p-2.5 border border-slate-300 rounded-lg" rows="2">${s.desc}</textarea>
                    </div>
                </div>
            `;
    });
}

function setToggleUI(isActive) {
    document.getElementById("toggle-intro").checked = isActive;
    const bg = document.getElementById("intro-bg");
    const dot = document.getElementById("intro-dot");
    if (isActive) {
        bg.classList.replace("bg-slate-300", "bg-emerald-400");
        dot.classList.add("translate-x-4");
    } else {
        bg.classList.replace("bg-emerald-400", "bg-slate-300");
        dot.classList.remove("translate-x-4");
    }
}

async function toggleIntroSystem() {
    if (!introSlideId) return;
    const cb = document.getElementById("toggle-intro");
    setToggleUI(cb.checked);
    await supabaseClient.from("buku").update({ is_active: cb.checked }).eq("id", introSlideId);
}

async function simpanEditIntro() {
    if (!introSlideId) return;
    let slides = [];
    for (let i = 0; i < 3; i++) {
        slides.push({
            judul: document.getElementById(`intro-judul-${i}`).value,
            desc: document.getElementById(`intro-desc-${i}`).value,
        });
    }
    await supabaseClient
        .from("buku")
        .update({ deskripsi: JSON.stringify(slides) })
        .eq("id", introSlideId);
    alert("✅ Pengaturan Slide Intro berhasil diperbarui!");
}

// ===================================
// 3. MANAJEMEN MODUL & LAINNYA
// ===================================
async function fetchDaftarBukuAdmin() {
    const { data } = await supabaseClient.from("buku").select("*").order("created_at", { ascending: false });
    const tabel = document.getElementById("tabelModul");
    const ddKuis = document.getElementById("formKuisBuku");
    const ddEditSinkron = document.getElementById("edit-kuisTerkait");
    const ddSinkron = document.getElementById("kuisTerkait");

    tabel.innerHTML = "";
    ddKuis.innerHTML = '<option value="">-- Pilih Wadah --</option>';
    let optTaut = '<option value="">-- Tidak ditautkan --</option>';
    dbBukuList = (data || []).filter((b) => b.tipe_konten !== "Pengantar Sistem"); // Sembunyikan Intro dari tabel list

    dbBukuList.forEach((b) => {
        let icon = b.tipe_konten === "Evaluasi Global" ? "🌟" : b.tipe_konten === "Hanya Kuis" ? "📝" : "📖";
        const isAktif = b.is_active === true;
        const toggleHtml = `
                <label class="flex items-center justify-center cursor-pointer">
                    <div class="relative">
                        <input type="checkbox" class="sr-only" ${isAktif ? "checked" : ""} onchange="toggleStatusModul('${b.id}', ${isAktif})">
                        <div class="block w-10 h-6 rounded-full transition ${isAktif ?"bg-emerald-400" : "bg-slate-300"}"></div>
                        <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${isAktif ?"translate-x-4" : ""}"></div>
                    </div>
                </label>`;

        tabel.innerHTML += `
                <tr class="border-b">
                    <td class="py-3 px-6">${icon} ${b.tipe_konten}</td>
                    <td class="py-3 px-6 font-bold">${b.judul}</td>
                    <td class="py-3 px-6 text-center">${toggleHtml}</td>
                    <td class="py-3 px-6 text-center">
                        <button onclick="bukaModalEditModul('${encodeURIComponent(JSON.stringify(b))}')" class="text-blue-500 bg-blue-50 p-2 rounded mr-1"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="hapusModul('${b.id}')" class="text-red-500 bg-red-50 p-2 rounded"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;

        ddKuis.innerHTML += `<option value="${b.id}">${icon} Target: ${b.judul}</option>`;
        if (b.tipe_konten !== "Modul PDF") optTaut += `<option value="${b.id}">Kuis: ${b.judul}</option>`;
    });

    ddEditSinkron.innerHTML = optTaut;
    ddSinkron.innerHTML = optTaut;
}

async function toggleStatusModul(id, statusSaatIni) {
    await supabaseClient.from("buku").update({ is_active: !statusSaatIni }).eq("id", id);
    fetchDaftarBukuAdmin();
}

async function simpanKontenBaru() {
    const tipe = document.getElementById("tipeKonten").value;
    const judul = document.getElementById("judulBuku").value;
    const fileInput = document.getElementById("filePdf");
    const sinkron = document.getElementById("kuisTerkait").value || null; // kosong = null (kolom bertipe uuid)

    if (!judul) return alert("Judul wajib diisi!");
    const btn = document.getElementById("btnUpload");
    document.getElementById("statusUpload").classList.remove("hidden");
    document.getElementById("statusUpload").innerText = "Memproses Upload...";
    btn.disabled = true;

    try {
        let pUrl = null,
            cUrl = null;
        if (tipe === "Modul PDF") {
            if (fileInput.files.length === 0) throw new Error("Pilih File PDF!");
            const file = fileInput.files[0];
            const fn = Date.now() + "_" + Math.random().toString(36).substring(7);

            const arrayBuffer = await file.arrayBuffer();

            try {
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                const coverBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
                await supabaseClient.storage
                    .from("pdf-buku")
                    .upload(fn + "_cover.jpg", coverBlob, { contentType: "image/jpeg" });
                cUrl = supabaseClient.storage.from("pdf-buku").getPublicUrl(fn + "_cover.jpg").data.publicUrl;
            } catch (e) {
                console.log("Gagal membuat cover otomatis");
            }

            await supabaseClient.storage
                .from("pdf-buku")
                .upload(fn + ".pdf", arrayBuffer, { contentType: "application/pdf" });
            pUrl = supabaseClient.storage.from("pdf-buku").getPublicUrl(fn + ".pdf").data.publicUrl;
        }

        if (tipe === "Evaluasi Global") {
            await supabaseClient.from("buku").insert([
                { judul: "Pre-Test: " + judul, tipe_konten: tipe },
                { judul: "Post-Test: " + judul, tipe_konten: tipe },
            ]);
        } else {
            await supabaseClient
                .from("buku")
                .insert([{ judul, tipe_konten: tipe, file_url: pUrl, cover_url: cUrl, id_kuis_terkait: sinkron }]);
        }
        window.location.reload();
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
        document.getElementById("statusUpload").innerText = "Gagal Upload!";
    }
}

function bukaModalEditModul(str) {
    const m = JSON.parse(decodeURIComponent(str));
    document.getElementById("edit-modul-id").value = m.id;
    document.getElementById("edit-modul-judul").value = m.judul;
    document.getElementById("edit-tipeKonten").value = m.tipe_konten;
    document.getElementById("edit-kuisTerkait").value = m.id_kuis_terkait || "";
    document.getElementById("areaFilePDF_edit").classList.toggle("hidden", m.tipe_konten !== "Modul PDF");
    document.getElementById("modalEditModul").classList.remove("hidden");
}

async function simpanEditModul() {
    const id = document.getElementById("edit-modul-id").value;
    const judul = document.getElementById("edit-modul-judul").value;
    const tipe = document.getElementById("edit-tipeKonten").value;
    const sinkronKuis = document.getElementById("edit-kuisTerkait").value || null;
    const fileInput = document.getElementById("edit-filePdf");
    const btn = document.getElementById("btnEditModul");
    btn.innerHTML = "Menyimpan...";
    btn.disabled = true;
    let payload = { judul: judul, tipe_konten: tipe, id_kuis_terkait: sinkronKuis };

    try {
        if (tipe === "Modul PDF" && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fn = Date.now() + "_" + Math.random().toString(36).substring(7);
            const arrayBuffer = await file.arrayBuffer();
            try {
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                const coverBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
                await supabaseClient.storage
                    .from("pdf-buku")
                    .upload(fn + "_cover.jpg", coverBlob, { contentType: "image/jpeg" });
                payload.cover_url = supabaseClient.storage
                    .from("pdf-buku")
                    .getPublicUrl(fn + "_cover.jpg").data.publicUrl;
            } catch (e) {}
            await supabaseClient.storage
                .from("pdf-buku")
                .upload(fn + ".pdf", arrayBuffer, { contentType: "application/pdf" });
            payload.file_url = supabaseClient.storage.from("pdf-buku").getPublicUrl(fn + ".pdf").data.publicUrl;
        }
        await supabaseClient.from("buku").update(payload).eq("id", id);
        window.location.reload();
    } catch (err) {
        alert("Gagal: " + err.message);
        btn.innerHTML = "Simpan Perubahan";
        btn.disabled = false;
    }
}

async function hapusModul(id) {
    if (confirm("Hapus?")) {
        await supabaseClient.from("buku").delete().eq("id", id);
        window.location.reload();
    }
}

// ===================================
// 4. MANAJEMEN KUIS & SPPS (SAMA SEPERTI SEBELUMNYA)
// ===================================
function bukaModalKuisTambah() {
    document.getElementById("modalTambahKuis").classList.remove("hidden");
    renderDynamicOptions();
}
function renderDynamicOptions() {
    const j = document.getElementById("formKuisJumlahOpsi").value;
    const w = document.getElementById("wadahDynamicOptions");
    w.innerHTML = "";
    for (let i = 0; i < j; i++) {
        w.innerHTML += `<div class="flex gap-2 mb-2"><span class="w-8 bg-slate-200 text-center font-bold p-2">${LABELS[i]}</span><input type="text" id="opt_${LABELS[i]}" class="w-full p-2 border" placeholder="Teks"><input type="number" id="poin_${LABELS[i]}" class="w-20 p-2 border" value="${i === 0 ? 1 : 0}"></div>`;
    }
}
function tambahKeDraft() {
    const p = document.getElementById("formKuisPertanyaan").value,
        d = document.getElementById("formKuisDimensi").value,
        j = document.getElementById("formKuisJumlahOpsi").value;
    if (!p) return alert("Isi soal!");
    let opsi = {},
        maxP = 0,
        jwb = "A";
    for (let i = 0; i < j; i++) {
        let t = document.getElementById(`opt_${LABELS[i]}`).value,
            po = parseInt(document.getElementById(`poin_${LABELS[i]}`).value);
        opsi[LABELS[i]] = { teks: t, poin: po };
        if (po > maxP) {
            maxP = po;
            jwb = LABELS[i];
        }
    }
    draftKuisArray.push({
        pertanyaan: p,
        opsi_jawaban: opsi,
        jawaban_benar: jwb,
        poin_reward: maxP,
        dimensi: d,
        jenis_kuis: "Pilihan Ganda",
    });
    document.getElementById("draftCount").innerText = draftKuisArray.length;
    document.getElementById("draftList").innerHTML += `<p class="truncate border-b py-1">${p}</p>`;
    document.getElementById("formKuisPertanyaan").value = "";
}
async function simpanKuisKeDatabase() {
    const b = document.getElementById("formKuisBuku").value;
    if (!b) return alert("Pilih wadah");
    await supabaseClient.from("kuis").insert(draftKuisArray.map((s) => ({ ...s, id_buku: b })));
    window.location.reload();
}

async function fetchDaftarKuis() {
    const { data } = await supabaseClient.from("kuis").select("id_buku");
    let m = {};
    if (data) data.forEach((q) => (m[q.id_buku] = (m[q.id_buku] || 0) + 1));
    const tb = document.getElementById("tabelKuis");
    tb.innerHTML = "";
    dbBukuList.forEach((b) => {
        if (m[b.id])
            tb.innerHTML += `<tr class="border-b"><td class="py-3 px-6 font-bold">${b.judul}</td><td class="py-3 px-6 text-center">${m[b.id]} Soal</td><td class="py-3 px-6 text-center"><button onclick="bukaListSoal('${b.id}','${b.judul}')" class="text-blue-500 bg-blue-50 p-2 rounded mr-1"><i class="fa-solid fa-list"></i> Lihat/Edit</button><button onclick="hapusSemuaKuisModul('${b.id}')" class="text-red-500 bg-red-50 p-2 rounded"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}
async function bukaListSoal(idBuku, judul) {
    document.getElementById("title-modal-list").innerText = "Soal: " + judul;
    const { data } = await supabaseClient.from("kuis").select("*").eq("id_buku", idBuku);
    const w = document.getElementById("wadah-list-soal");
    w.innerHTML = "";
    data.forEach((q) => {
        w.innerHTML += `<div class="p-3 border rounded flex justify-between bg-slate-50"><p class="text-sm truncate w-3/4">${q.pertanyaan}</p><button onclick="bukaModalEditSoal('${encodeURIComponent(JSON.stringify(q))}')" class="text-indigo-600 font-bold text-xs bg-white px-3 border rounded shadow-sm">Edit</button></div>`;
    });
    document.getElementById("modalListSoal").classList.remove("hidden");
}

let currentEditSoalOpsi = null;
function bukaModalEditSoal(qStr) {
    const q = JSON.parse(decodeURIComponent(qStr));
    document.getElementById("edit-soal-id").value = q.id;
    document.getElementById("edit-soal-dimensi").value = q.dimensi || "Umum";
    document.getElementById("edit-soal-teks").value = q.pertanyaan;
    currentEditSoalOpsi = q.opsi_jawaban || {};
    document.getElementById("edit-soal-jumlah-opsi").value = Object.keys(currentEditSoalOpsi).length || 3;
    renderEditDynamicOptions(q.jawaban_benar);
    document.getElementById("modalEditSoal").classList.remove("hidden");
}
function renderEditDynamicOptions(kunciJawabanAsli = "A") {
    const j = document.getElementById("edit-soal-jumlah-opsi").value;
    const w = document.getElementById("edit-wadahDynamicOptions");
    w.innerHTML = "";
    for (let i = 0; i < j; i++) {
        const abjad = LABELS[i];
        let teks = "";
        let poin = 0;
        if (currentEditSoalOpsi && currentEditSoalOpsi[abjad]) {
            const opt = currentEditSoalOpsi[abjad];
            teks = typeof opt === "string" ? opt : opt.teks;
            poin = typeof opt === "string" ? (abjad === kunciJawabanAsli ? 10 : 0) : parseInt(opt.poin || 0);
        } else if (i === 0) {
            poin = 1;
        }
        w.innerHTML += `<div class="flex gap-2 mb-2"><span class="w-8 bg-slate-200 text-center font-bold p-2">${abjad}</span><input type="text" id="edit-opt_${abjad}" class="w-full p-2 border rounded" placeholder="Teks opsi" value="${teks}"><input type="number" id="edit-poin_${abjad}" class="w-20 p-2 border rounded" value="${poin}"></div>`;
    }
}
async function simpanEditSoal() {
    const id = document.getElementById("edit-soal-id").value;
    const p = document.getElementById("edit-soal-teks").value;
    const d = document.getElementById("edit-soal-dimensi").value;
    const j = document.getElementById("edit-soal-jumlah-opsi").value;
    if (!p) return alert("Kosong!");
    let opsi = {};
    let maxP = 0;
    let jwb = "A";
    for (let i = 0; i < j; i++) {
        const t = document.getElementById(`edit-opt_${LABELS[i]}`).value;
        const po = parseInt(document.getElementById(`edit-poin_${LABELS[i]}`).value);
        if (!t) return alert(`Teks opsi ${LABELS[i]} kosong!`);
        opsi[LABELS[i]] = { teks: t, poin: po };
        if (po > maxP) {
            maxP = po;
            jwb = LABELS[i];
        }
    }
    await supabaseClient
        .from("kuis")
        .update({ pertanyaan: p, dimensi: d, opsi_jawaban: opsi, jawaban_benar: jwb, poin_reward: maxP })
        .eq("id", id);
    tutupModal("modalEditSoal");
    tutupModal("modalListSoal");
    fetchDaftarKuis();
}
async function hapusSemuaKuisModul(id) {
    if (confirm("Kosongkan soal?")) {
        await supabaseClient.from("kuis").delete().eq("id_buku", id);
        window.location.reload();
    }
}
