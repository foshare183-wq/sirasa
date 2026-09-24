// Logika halaman buku.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let loggedInUser = null;
let dataBuku = null;
let bookId = null;
let kuisSudahDipicu = false;
let adaKuisInternal = false;
let waktuMulaiMembaca = Date.now();
let waktuMulaiKuis = 0;
let currentQuizData = [];
let dimGroups = {};
let idKuisAktif = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof CONFIG === "undefined") return alert("config.js tidak terbaca!");
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) return (window.location.href = "dashboard.html");
    loggedInUser = session.user;
    bookId = new URLSearchParams(window.location.search).get("id");
    if (!bookId) return keluarKeBeranda();

    try {
        const { data: bukuInfo } = await supabaseClient.from("buku").select("*").eq("id", bookId).single();
        if (!bukuInfo) return keluarKeBeranda();
        dataBuku = bukuInfo;

        const { count } = await supabaseClient
            .from("kuis")
            .select("*", { count: "exact", head: true })
            .eq("id_buku", bookId);
        if (count && count > 0) adaKuisInternal = true;

        if (dataBuku.tipe_konten === "Hanya Kuis" || dataBuku.tipe_konten === "Evaluasi Global") {
            document.getElementById("nav-atas").classList.add("hidden");
            document.getElementById("wadah-buku").classList.add("hidden");
            return panggilKuisSekarang(bookId, dataBuku.judul);
        }

        // Paksa selalu ambil file PDF terbaru langsung dari database!
        const pdfBersih = dataBuku.file_url;
        if (!pdfBersih) {
            alert("Modul PDF belum diunggah atau kosong!");
            return keluarKeBeranda();
        }
        document.getElementById("wadah-buku").innerHTML =
            `<div class="_df_book" id="df_container" source="${pdfBersih}"></div>`;

        siapkanTTS(pdfBersih);

        window.DFLIP.defaults.onFlip = function (flipbook) {
            let halSekarang = flipbook.target._activePage || flipbook.target.page;
            let totalHal = flipbook.target.pageCount || flipbook.options.pageCount;
            let btnSelesai = document.getElementById("btn-selesai");
            if (halSekarang && totalHal && halSekarang >= totalHal) {
                btnSelesai.classList.remove("hidden");
                btnSelesai.classList.add("flex");
                if (!kuisSudahDipicu) {
                    kuisSudahDipicu = true;
                    setTimeout(() => {
                        tampilkanKonfirmasiSelesai();
                    }, 800);
                }
            } else {
                btnSelesai.classList.add("hidden");
                btnSelesai.classList.remove("flex");
                kuisSudahDipicu = false;
            }
        };
        if (window.DFLIP && window.DFLIP.parseBooks) window.DFLIP.parseBooks();
    } catch (err) {
        alert("Gagal memuat modul.");
        keluarKeBeranda();
    }
});

function tampilkanKonfirmasiSelesai() {
    hentikanTTS(); // hentikan bacaan begitu modal keputusan muncul, biar tidak bertabrakan
    document.getElementById("modalSelesai").classList.remove("hidden");
    const btnKuis = document.getElementById("btn-lanjut-kuis");

    if (adaKuisInternal) {
        btnKuis.classList.remove("hidden");
        btnKuis.setAttribute("onclick", `transisiKeKuis('${bookId}', '${dataBuku.judul}')`);
    } else if (dataBuku.id_kuis_terkait && dataBuku.id_kuis_terkait.trim() !== "") {
        btnKuis.classList.remove("hidden");
        btnKuis.setAttribute("onclick", `transisiKeKuis('${dataBuku.id_kuis_terkait}', 'Evaluasi Lanjutan')`);
    } else {
        document.getElementById("btn-tutup-modul").classList.remove("hidden");
    }
}

function tutupModalSelesai() {
    document.getElementById("modalSelesai").classList.add("hidden");
    kuisSudahDipicu = false;
}

async function simpanDurasiBaca() {
    try {
        await supabaseClient
            .from("riwayat_kuis")
            .insert([
                {
                    id_user: loggedInUser.id,
                    id_buku: bookId,
                    poin_didapat: 0,
                    durasi_baca_detik: Math.floor((Date.now() - waktuMulaiMembaca) / 1000),
                    jenis_tes: "Membaca Modul PDF",
                    dimensi: "Aktivitas",
                },
            ]);
    } catch (e) {}
}

async function keluarKeBeranda() {
    hentikanTTS();
    document.body.style.cursor = "wait";
    await simpanDurasiBaca();
    window.location.href = "dashboard.html";
}

async function transisiKeKuis(targetIdKuis, judulTarget) {
    hentikanTTS();
    document.getElementById("tts-panel").classList.add("hidden");
    document.getElementById("btn-lanjut-kuis").innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Evaluasi...';
    await simpanDurasiBaca();
    tutupModalSelesai();

    document.getElementById("nav-atas").classList.add("hidden");
    document.getElementById("wadah-buku").classList.add("opacity-0");
    setTimeout(() => {
        document.getElementById("wadah-buku").classList.add("hidden");
    }, 500);
    panggilKuisSekarang(targetIdKuis, judulTarget);
}

async function panggilKuisSekarang(targetId, judulKuis) {
    idKuisAktif = targetId;
    document.getElementById("header-judul-kuis").innerHTML = `<i class="fa-solid fa-pen-clip mr-2"></i> ${judulKuis}`;
    document.getElementById("wadah-ujian").classList.remove("hidden");

    try {
        const { data } = await supabaseClient
            .from("kuis")
            .select("*")
            .eq("id_buku", targetId)
            .order("id", { ascending: true });
        if (!data || data.length === 0) {
            alert("Tidak ada soal pada modul ini.");
            return keluarKeBeranda();
        }

        currentQuizData = data;
        waktuMulaiKuis = Date.now();
        renderSoalKeseluruhan();
    } catch (e) {
        alert("Gagal mengambil soal.");
        keluarKeBeranda();
    }
}

function renderSoalKeseluruhan() {
    const container = document.getElementById("quiz-content");
    dimGroups = {};
    currentQuizData.forEach((q) => {
        const dim = q.dimensi || "Umum";
        if (!dimGroups[dim]) dimGroups[dim] = [];
        dimGroups[dim].push(q);
    });

    let htmlKuis = `<form id="form-evaluasi" onsubmit="event.preventDefault(); prosesKirimEvaluasi();">`;
    let nomorGlobal = 1;

    Object.keys(dimGroups).forEach((namaDimensi) => {
        htmlKuis += `<div class="mb-8 border-2 border-slate-100 bg-white rounded-2xl shadow-sm overflow-hidden quiz-enter"><div class="bg-indigo-50 px-5 py-4 border-b border-indigo-100 flex items-center gap-3"><i class="fa-solid fa-tags text-indigo-500"></i><h3 class="font-black text-indigo-800 uppercase tracking-wide text-sm md:text-base">Dimensi: ${namaDimensi}</h3></div><div class="p-5 md:p-8 space-y-10">`;
        dimGroups[namaDimensi].forEach((soal) => {
            let htmlOpsi = "";
            if (soal.opsi_jawaban) {
                const keys = Object.keys(soal.opsi_jawaban);
                htmlOpsi = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">`;
                keys.forEach((k) => {
                    const opt = soal.opsi_jawaban[k];
                    const teks = typeof opt === "string" ? opt : opt.teks;
                    const poinVal =
                        typeof opt === "string"
                            ? k === soal.jawaban_benar
                                ? soal.poin_reward || 1
                                : 0
                            : parseInt(opt.poin || 0);
                    htmlOpsi += `<label class="radio-card flex items-start gap-3 p-4 border-2 border-slate-100 rounded-xl cursor-pointer transition hover:bg-slate-50"><input type="radio" name="jawaban_${soal.id}" value="${k}" data-poin="${poinVal}" class="mt-1 w-4 h-4 accent-rose-600 shrink-0" required><span class="text-slate-600 font-medium text-sm leading-snug">${teks}</span></label>`;
                });
                htmlOpsi += `</div>`;
            }
            htmlKuis += `<div><p class="font-bold text-slate-800 text-base md:text-lg leading-relaxed"><span class="text-rose-500 mr-2">${nomorGlobal}.</span>${soal.pertanyaan}</p>${htmlOpsi}</div>`;
            nomorGlobal++;
        });
        htmlKuis += `</div></div>`;
    });

    htmlKuis += `</form>`;
    container.innerHTML = htmlKuis;
    document.getElementById("quiz-footer").innerHTML =
        `<button type="submit" form="form-evaluasi" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-lg"><i class="fa-solid fa-paper-plane"></i> Kirim Jawaban Evaluasi</button>`;
}

async function prosesKirimEvaluasi() {
    const form = document.getElementById("form-evaluasi");
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    if (!confirm("Yakin ingin mengirim evaluasi?")) return;

    const btn = document.querySelector("#quiz-footer button");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Menyimpan...";

    const formData = new FormData(form);
    let totalPoinDiDapat = 0;
    const payloadRiwayat = [];
    const durasiKuisReal = Math.floor((Date.now() - waktuMulaiKuis) / 1000);

    Object.keys(dimGroups).forEach((namaDimensi) => {
        let skorDimensi = 0;
        let rekamanJawaban = {};
        dimGroups[namaDimensi].forEach((q) => {
            const jwbUser = formData.get(`jawaban_${q.id}`);
            if (q.opsi_jawaban && q.opsi_jawaban[jwbUser]) {
                const opt = q.opsi_jawaban[jwbUser];
                skorDimensi +=
                    typeof opt === "string"
                        ? jwbUser === q.jawaban_benar
                            ? q.poin_reward || 1
                            : 0
                        : parseInt(opt.poin || 0);
                rekamanJawaban[q.id] = jwbUser;
            }
        });
        totalPoinDiDapat += skorDimensi;

        payloadRiwayat.push({
            id_user: loggedInUser.id,
            id_buku: idKuisAktif,
            poin_didapat: skorDimensi,
            durasi_baca_detik: durasiKuisReal,
            jenis_tes:
                dataBuku.tipe_konten === "Evaluasi Global" ? `${dataBuku.judul} - ${namaDimensi}` : dataBuku.judul,
            dimensi: namaDimensi,
            detail_jawaban: rekamanJawaban,
        });
    });

    try {
        // LOGIKA PRE-TEST: Jika judul mengandung "Pre-Test", jangan beri XP
        const isPreTest =
            dataBuku.judul.toLowerCase().includes("pre-test") || dataBuku.judul.toLowerCase().includes("pre test");
        const xpYangDitambahkan = isPreTest ? 0 : totalPoinDiDapat;

        if (xpYangDitambahkan > 0) {
            const { data: profil } = await supabaseClient
                .from("profiles")
                .select("total_poin")
                .eq("id", loggedInUser.id)
                .single();
            await supabaseClient
                .from("profiles")
                .update({ total_poin: (profil.total_poin || 0) + xpYangDitambahkan })
                .eq("id", loggedInUser.id);
        }

        const { error: errRiwayat } = await supabaseClient.from("riwayat_kuis").insert(payloadRiwayat);
        if (errRiwayat) throw errRiwayat;

        document.getElementById("wadah-ujian").classList.add("hidden");

        // Tampilan Selesai berdasarkan tipe tes
        let uiPoin = isPreTest
            ? `<div class="bg-indigo-50 border border-indigo-200 px-6 py-4 rounded-xl mb-6"><span class="text-indigo-700 font-bold text-sm">Terima kasih! Tahap evaluasi awal telah selesai direkam.</span></div>`
            : `<div class="inline-block bg-rose-50 border border-rose-200 px-8 py-4 rounded-2xl mb-8 shadow-sm"><span class="text-rose-600 font-black text-xl">+ ${xpYangDitambahkan} XP!</span></div>`;

        const htmlSukses = `
            <div class="w-full h-full bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 absolute inset-0 z-50">
                <div class="text-center py-10 bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full quiz-enter border border-slate-200">
                    <div class="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6"><i class="fa-solid fa-trophy text-rose-500 text-5xl"></i></div>
                    <h3 class="font-display text-2xl font-bold text-slate-900 mb-2">Penyelesaian berhasil! 🎉</h3>
                    <p class="text-slate-500 mb-6 text-sm">Jawabanmu sudah tercatat di dalam sistem.</p>
                    ${uiPoin}
                    <button onclick="window.location.href='dashboard.html'" class="btn-pop w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5" style="--btn-pop-shadow:#432574"><i class="fa-solid fa-house mr-2"></i> Kembali ke menu utama</button>
                </div>
            </div>`;

        document.body.insertAdjacentHTML("beforeend", htmlSukses);
        if (xpYangDitambahkan > 0 && typeof tembakConfetti === "function") tembakConfetti();
    } catch (err) {
        alert("Gagal mengirim data: " + err.message);
        btn.disabled = false;
        btn.innerHTML = `Coba Kirim Ulang`;
    }
}

// ==========================================
// FITUR BACA OTOMATIS (Text-to-Speech)
// ==========================================
// DearFlip sendiri memuat pdf.js secara dinamis untuk merender halaman
// flipbook. Modul ini menunggu salinan itu tersedia sebagai window.pdfjsLib
// lalu memakainya untuk mengekstrak teks per halaman, dan Web Speech API
// bawaan browser untuk membacakannya. Semua proses berjalan di perangkat
// pengguna sendiri -- tidak ada audio atau teks yang dikirim ke server mana pun.
let ttsDokumen = null;
let ttsTotalHalaman = 0;
let ttsHalamanAktif = 1;
let ttsSedangJalan = false; // true selama mode baca aktif (termasuk saat dijeda)
let ttsDijeda = false;
let ttsKecepatan = 1;

function tungguPdfJs(batasMs = 20000) {
    return new Promise((selesai) => {
        const mulai = Date.now();
        (function cek() {
            if (window.pdfjsLib && window.pdfjsLib.getDocument) return selesai(window.pdfjsLib);
            if (Date.now() - mulai > batasMs) return selesai(null);
            setTimeout(cek, 250);
        })();
    });
}

async function siapkanTTS(urlPdf) {
    if (!("speechSynthesis" in window)) return; // browser tidak mendukung -> panel tetap tersembunyi
    const pdfjsLib = await tungguPdfJs();
    if (!pdfjsLib || !urlPdf) return;
    try {
        ttsDokumen = await pdfjsLib.getDocument(urlPdf).promise;
        ttsTotalHalaman = ttsDokumen.numPages;
        document.getElementById("tts-panel").classList.remove("hidden");
    } catch (err) {
        console.error("TTS: gagal menyiapkan teks PDF untuk dibaca", err);
    }
}

async function ambilTeksHalamanTTS(nomor) {
    const halaman = await ttsDokumen.getPage(nomor);
    const konten = await halaman.getTextContent();
    return konten.items.map((item) => item.str).join(" ");
}

// Web Speech API kerap berhenti di tengah jalan untuk teks yang sangat panjang,
// jadi teks dipecah per kalimat dan dibacakan sepotong-sepotong.
function pecahJadiKalimat(teks) {
    const bersih = (teks || "").replace(/\s+/g, " ").trim();
    if (!bersih) return [];
    const kalimat = bersih.match(/[^.!?]+[.!?]*/g) || [bersih];
    const potongan = [];
    let sedang = "";
    kalimat.forEach((k) => {
        if (sedang && (sedang + k).length > 220) {
            potongan.push(sedang.trim());
            sedang = "";
        }
        sedang += k;
    });
    if (sedang.trim()) potongan.push(sedang.trim());
    return potongan;
}

function suaraIndonesia() {
    const daftar = speechSynthesis.getVoices();
    return daftar.find((v) => v.lang && v.lang.toLowerCase().startsWith("id")) || null;
}

function tombolPlayTTS() {
    if (ttsSedangJalan && !ttsDijeda) jedaTTS();
    else if (ttsDijeda) lanjutkanTTS();
    else mulaiTTS();
}

function mulaiTTS() {
    if (!ttsDokumen) return;
    ttsSedangJalan = true;
    ttsDijeda = false;
    perbaruiUiTTS();
    bacaDariHalamanTTS(ttsHalamanAktif || 1);
}

function jedaTTS() {
    ttsDijeda = true;
    speechSynthesis.cancel(); // lebih andal daripada pause() di beberapa browser
    perbaruiUiTTS();
}

function lanjutkanTTS() {
    ttsDijeda = false;
    perbaruiUiTTS();
    bacaDariHalamanTTS(ttsHalamanAktif);
}

function hentikanTTS() {
    ttsSedangJalan = false;
    ttsDijeda = false;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    perbaruiUiTTS();
}

function ubahKecepatanBaca(nilai) {
    ttsKecepatan = parseFloat(nilai) || 1;
}

async function bacaDariHalamanTTS(nomor) {
    if (!ttsSedangJalan) return;
    if (nomor > ttsTotalHalaman) {
        hentikanTTS();
        return;
    }
    ttsHalamanAktif = nomor;
    perbaruiUiTTS();
    if (window.df_container && window.df_container.gotoPage) {
        try {
            window.df_container.gotoPage(nomor);
        } catch (e) {}
    }

    let teks = "";
    try {
        teks = await ambilTeksHalamanTTS(nomor);
    } catch (e) {}
    const potongan = pecahJadiKalimat(teks);

    if (potongan.length === 0) {
        // Halaman tanpa teks (mis. sampul bergambar) -> jeda singkat lalu lanjut ke halaman berikutnya
        setTimeout(() => {
            if (ttsSedangJalan && !ttsDijeda && ttsHalamanAktif === nomor) bacaDariHalamanTTS(nomor + 1);
        }, 1200);
        return;
    }
    bacaPotonganTTS(potongan, 0, nomor);
}

function bacaPotonganTTS(potongan, indeks, halaman) {
    if (!ttsSedangJalan || ttsDijeda || halaman !== ttsHalamanAktif) return;
    if (indeks >= potongan.length) {
        bacaDariHalamanTTS(halaman + 1);
        return;
    }
    const ucapan = new SpeechSynthesisUtterance(potongan[indeks]);
    ucapan.lang = "id-ID";
    ucapan.rate = ttsKecepatan;
    const suara = suaraIndonesia();
    if (suara) ucapan.voice = suara;
    ucapan.onend = () => bacaPotonganTTS(potongan, indeks + 1, halaman);
    ucapan.onerror = () => bacaPotonganTTS(potongan, indeks + 1, halaman);
    speechSynthesis.speak(ucapan);
}

function perbaruiUiTTS() {
    const ikon = document.getElementById("tts-play-icon");
    if (!ikon) return;
    const status = document.getElementById("tts-status");
    const halamanTeks = document.getElementById("tts-halaman");
    const equalizer = document.getElementById("tts-equalizer");
    const stopBtn = document.getElementById("tts-stop");

    const aktifBicara = ttsSedangJalan && !ttsDijeda;
    ikon.className = "fa-solid " + (aktifBicara ? "fa-pause" : "fa-play");
    equalizer.classList.toggle("flex", aktifBicara);
    equalizer.classList.toggle("hidden", !aktifBicara);
    stopBtn.classList.toggle("flex", ttsSedangJalan);
    stopBtn.classList.toggle("hidden", !ttsSedangJalan);

    if (!ttsSedangJalan) {
        status.textContent = "Dengarkan modul ini";
        halamanTeks.textContent = "Suara dibuat otomatis dari teks PDF";
    } else if (ttsDijeda) {
        status.textContent = "Dijeda";
        halamanTeks.textContent = `Halaman ${ttsHalamanAktif} dari ${ttsTotalHalaman}`;
    } else {
        status.textContent = "Sedang membaca…";
        halamanTeks.textContent = `Halaman ${ttsHalamanAktif} dari ${ttsTotalHalaman}`;
    }
}
