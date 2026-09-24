// Logika halaman dashboard.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let loggedInUser = null;
let semuaBuku = [];

document.addEventListener("DOMContentLoaded", () => {
    try {
        if (typeof CONFIG === "undefined") throw new Error("config.js tidak terbaca!");
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        cekStatusLogin();
    } catch (error) {
        console.error("Terjadi kesalahan sistem:", error);
        alert("Sistem gagal memuat konfigurasi. Pastikan file config.js tersedia.");
    }
});

async function cekStatusLogin() {
    const {
        data: { session },
        error,
    } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
        return;
    }

    loggedInUser = session.user;
    const menuContainer = document.getElementById("user-menu-container");

    // PERBAIKAN LOGIKA: Menggunakan maybeSingle agar tidak crash jika profil kosong
    const { data: profil } = await supabaseClient.from("profiles").select("*").eq("id", loggedInUser.id).maybeSingle();

    if (profil) {
        menuContainer.innerHTML = `
            <div class="flex items-center gap-2">
                <a href="profil.html" class="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition" title="Lihat rapor belajar">
                    <span class="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center text-sm font-bold">${esc(profil.nama_lengkap.charAt(0).toUpperCase())}</span>
                    <span class="hidden sm:block text-sm font-semibold text-slate-800">${esc(profil.nama_lengkap.split(" ")[0])}</span>
                </a>
                <button onclick="prosesLogout()" class="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition">Keluar</button>
            </div>`;

        document.getElementById("greet-name").innerText = `Halo, ${profil.nama_lengkap.split(" ")[0]}`;
        document.getElementById("greet-xp").innerText = (profil.total_poin || 0).toLocaleString("id-ID");
        perbaruiKartuLevel(profil.total_poin || 0);

        fetchBooks();
        fetchLeaderboard();
    } else {
        // Fallback jika profil tidak ditemukan, tetap render agar layar tidak kosong
        document.getElementById("greet-name").innerText = "Halo";
        fetchBooks();
        fetchLeaderboard();
    }
}

/** Isi cincin dan lencana level di kartu sapaan berdasarkan total XP. */
function perbaruiKartuLevel(totalPoin) {
    const { level, poinDiLevel, xpPerLevel, persen } = hitungLevel(totalPoin);
    document.getElementById("greet-level").innerText = level;
    document.getElementById("ring-level").style.setProperty("--progres", persen);
    document.getElementById("greet-xp-sisa").innerText =
        poinDiLevel === 0 && totalPoin > 0
            ? "Level naik! Lanjutkan misinya"
            : `${xpPerLevel - poinDiLevel} XP lagi menuju level ${level + 1}`;
}

function tampilkanModalIntro(fileUrl) {
    document.getElementById("modalIntroSystem").classList.remove("hidden");
    document.getElementById("wadah-flipbook-intro").innerHTML =
        `<div class="_df_book" source="${fileUrl}" id="df_manual_intro"></div>`;
    if (window.DFLIP && window.DFLIP.parseBooks) window.DFLIP.parseBooks();
}

function tutupModalIntro() {
    document.getElementById("modalIntroSystem").classList.add("hidden");
    document.getElementById("wadah-flipbook-intro").innerHTML = "";
}

async function prosesLogout() {
    if (confirm("Yakin ingin mengakhiri sesi belajar?")) {
        await supabaseClient.auth.signOut();
        sessionStorage.removeItem("introSudahDilihat");
        window.location.href = "index.html";
    }
}

function arahkanMembaca(idBuku) {
    // File PDF selalu diambil ulang dari database di buku.js, jadi cukup kirim id
    window.location.href = `buku.html?id=${encodeURIComponent(idBuku)}`;
}

function alertTerkunci() {
    alert("Modul ini belum dibuka. Tunggu arahan dari peneliti.");
}

function filterBuku(kategori, btnElement) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.setAttribute("aria-pressed", "false"));
    btnElement.setAttribute("aria-pressed", "true");
    const filtered = kategori === "Semua" ? semuaBuku : semuaBuku.filter((b) => b.kategori === kategori);
    renderGridBuku(filtered);
}

async function fetchBooks() {
    try {
        const { data } = await supabaseClient
            .from("buku")
            .select("*")
            .neq("tipe_konten", "Pengantar Sistem")
            .order("created_at", { ascending: true });
        if (!data || data.length === 0) {
            document.getElementById("bookList").innerHTML =
                `<div class="col-span-full text-center text-slate-400 py-10 bg-white rounded-2xl border border-dashed border-slate-300"><i class="fa-solid fa-box-open text-4xl mb-3 text-slate-300"></i><p class="font-medium">Belum ada modul di galeri.</p></div>`;
            return;
        }
        semuaBuku = data;
        renderGridBuku(semuaBuku);
    } catch (err) {
        console.error("Gagal memuat buku:", err);
    }
}

function jenisModul(book) {
    const judul = (book.judul || "").toLowerCase();
    if (judul.includes("pre-test") || judul.includes("pre test"))
        return { label: "Pre-test", ikon: "fa-flag-checkered", warna: "sky" };
    if (judul.includes("post-test") || judul.includes("post test"))
        return { label: "Post-test", ikon: "fa-trophy", warna: "amber" };
    if (book.tipe_konten === "Hanya Kuis" || book.tipe_konten === "Evaluasi Global")
        return { label: "Kuis", ikon: "fa-list-check", warna: "violet" };
    return { label: "Materi", ikon: "fa-book-open-reader", warna: "teal" };
}

const WARNA_KARTU = {
    teal: { bg: "bg-teal-600", chip: "text-teal-700 bg-teal-50" },
    sky: { bg: "bg-sky-500", chip: "text-sky-700 bg-sky-50" },
    amber: { bg: "bg-amber-500", chip: "text-amber-700 bg-amber-50" },
    violet: { bg: "bg-violet-600", chip: "text-violet-700 bg-violet-50" },
};

function renderGridBuku(dataBuku) {
    const bookList = document.getElementById("bookList");

    if (dataBuku.length === 0) {
        bookList.innerHTML = `<p class="col-span-full text-sm text-slate-500 py-10">Belum ada modul untuk pilihan ini.</p>`;
        return;
    }

    bookList.innerHTML = dataBuku
        .map((book, i) => {
            const terkunci = book.is_active === false || book.is_active === null;
            const jenis = jenisModul(book);
            const w = WARNA_KARTU[jenis.warna];
            const aksi = terkunci ? "alertTerkunci()" : `arahkanMembaca('${book.id}')`;
            const sudut = i % 2 === 0 ? "-1.5deg" : "1.5deg";

            const sampul = book.cover_url
                ? `<img src="${esc(book.cover_url)}" alt="" loading="lazy" class="w-full h-full object-cover">`
                : `<div class="w-full h-full flex items-center justify-center ${w.bg}">
                       <i class="fa-solid ${jenis.ikon} text-4xl text-white/85"></i>
                   </div>`;

            return `
            <button type="button" onclick="${aksi}" class="kartu-modul text-left group ${terkunci ? "is-terkunci" : ""}" ${terkunci ? 'aria-disabled="true"' : ""} style="--kartu-sudut:${sudut}">
                <div class="aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 relative shadow-sm">
                    ${sampul}
                    ${terkunci ? '<span class="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center"><span class="bg-white text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full shadow"><i class="fa-solid fa-lock mr-1.5"></i>Terkunci</span></span>' : ""}
                    ${!terkunci ? `<span class="absolute top-2 left-2 ${w.chip} text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">${jenis.label}</span>` : ""}
                </div>
                <h4 class="mt-3 text-[15px] font-bold leading-snug text-slate-900 line-clamp-2">${esc(book.judul)}</h4>
            </button>`;
        })
        .join("");
}

async function fetchLeaderboard() {
    try {
        // Memakai fungsi get_leaderboard (supabase/02_rls_policies.sql) yang hanya
        // mengembalikan nama depan, kategori, dan poin, tanpa membuka data profil lain.
        let { data, error } = await supabaseClient.rpc("get_leaderboard", { jumlah: 5 });
        if (error) {
            // Cadangan sementara jika SQL belum dijalankan
            ({ data } = await supabaseClient
                .from("profiles")
                .select("nama_lengkap, total_poin, kategori")
                .gt("total_poin", 0)
                .order("total_poin", { ascending: false })
                .limit(5));
        }
        const wadah = document.getElementById("leaderboard-list");
        wadah.innerHTML = "";

        if (!data || data.length === 0) {
            wadah.innerHTML =
                '<li class="py-3 text-sm text-slate-500">Belum ada yang mengumpulkan poin. Selesaikan post-test pertamamu untuk masuk daftar.</li>';
            return;
        }

        const MEDALI = [
            { bg: "bg-amber-400", icon: "fa-crown" },
            { bg: "bg-slate-300", icon: "fa-medal" },
            { bg: "bg-amber-700", icon: "fa-medal" },
        ];
        wadah.innerHTML = data
            .map((p, i) => {
                const m = MEDALI[i];
                const lencana = m
                    ? `<span class="w-8 h-8 rounded-full ${m.bg} text-white flex items-center justify-center text-xs shadow-sm"><i class="fa-solid ${m.icon}"></i></span>`
                    : `<span class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">${i + 1}</span>`;
                return `
            <li class="flex items-center gap-3 p-2 rounded-xl ${i === 0 ? "bg-amber-50" : ""}">
                ${lencana}
                <span class="flex-1 min-w-0">
                    <span class="block text-sm font-bold text-slate-900 truncate">${esc((p.nama_lengkap || "").split(" ")[0])}</span>
                    <span class="block text-xs text-slate-500">${esc(p.kategori || "Umum")}</span>
                </span>
                <span class="text-sm font-bold text-slate-900">${Number(p.total_poin).toLocaleString("id-ID")}<span class="text-[10px] font-semibold text-slate-400"> XP</span></span>
            </li>`;
            })
            .join("");
    } catch (err) {
        console.error("Gagal memuat leaderboard:", err);
    }
}
