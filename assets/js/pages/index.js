// Logika halaman index.html
// Dimuat setelah config.js dan common.js

let supabaseClient;
let slidesDOM = [];
let dotsDOM = [];
let currentSlideIndex = 0;
const iconList = [
    "fa-hand-holding-heart",
    "fa-book-open-reader",
    "fa-ranking-star",
    "fa-rocket",
    "fa-lightbulb",
    "fa-award",
];

try {
    if (typeof CONFIG === "undefined") throw new Error("config.js tidak terbaca!");
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    cekStatusLogin();
} catch (err) {
    console.error(err);
}

async function cekStatusLogin() {
    const {
        data: { session },
    } = await supabaseClient.auth.getSession();
    if (session) {
        if (!sessionStorage.getItem("introSudahDilihat")) {
            const { data: introData } = await supabaseClient
                .from("buku")
                .select("is_active, deskripsi")
                .eq("tipe_konten", "Pengantar Sistem")
                .maybeSingle();
            if (introData && introData.is_active) {
                try {
                    const slideData = JSON.parse(introData.deskripsi);
                    if (slideData && slideData.length > 0) {
                        const wadahSlide = document.getElementById("wadah-slides-intro");
                        const wadahDots = document.getElementById("wadah-dots-intro");
                        wadahSlide.innerHTML = "";
                        wadahDots.innerHTML = "";

                        slideData.forEach((s, i) => {
                            const hiddenClass = i === 0 ? "opacity-100 z-10" : "opacity-0 translate-x-full hidden z-0";
                            const dotClass = i === 0 ? "bg-slate-900" : "bg-slate-300";
                            const icon = iconList[i % iconList.length];

                            wadahSlide.innerHTML += `
                                <div class="intro-slide absolute inset-0 p-8 md:p-12 flex flex-col items-center justify-center text-center slide-content ${hiddenClass} bg-white">
                                    <div class="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-2xl mb-6"><i class="fa-solid ${icon}"></i></div>
                                    <h3 class="text-2xl font-extrabold text-slate-950 mb-3">${esc(s.judul)}</h3>
                                    <p class="text-slate-600 text-base md:text-lg leading-relaxed max-w-md">${esc(s.desc)}</p>
                                </div>`;

                            wadahDots.innerHTML += `<div class="intro-dot w-2.5 h-2.5 rounded-full ${dotClass} transition-colors"></div>`;
                        });
                        slidesDOM = document.querySelectorAll(".intro-slide");
                        dotsDOM = document.querySelectorAll(".intro-dot");
                        currentSlideIndex = 0;
                        updateSlideUI();
                        document.getElementById("modalIntroSystem").classList.remove("hidden");
                        sessionStorage.setItem("introSudahDilihat", "true");
                        return;
                    }
                } catch (e) {}
            }
        }
        window.location.href = "dashboard.html";
    }
}

function updateSlideUI() {
    slidesDOM.forEach((slide, index) => {
        if (index === currentSlideIndex) {
            slide.classList.remove("hidden", "opacity-0", "translate-x-full", "-translate-x-full");
            slide.classList.add("opacity-100", "z-10");
            dotsDOM[index].classList.add("bg-slate-900");
            dotsDOM[index].classList.remove("bg-slate-300");
        } else {
            slide.classList.add("opacity-0", index < currentSlideIndex ? "-translate-x-full" : "translate-x-full");
            slide.classList.remove("opacity-100", "z-10");
            setTimeout(() => slide.classList.add("hidden"), 400);
            dotsDOM[index].classList.remove("bg-slate-900");
            dotsDOM[index].classList.add("bg-slate-300");
        }
    });
    if (currentSlideIndex === slidesDOM.length - 1) {
        document.getElementById("btn-next-slide").classList.add("hidden");
        document.getElementById("btn-skip-intro").classList.add("hidden");
        document.getElementById("btn-start-app").classList.remove("hidden");
        document.getElementById("btn-start-app").classList.add("flex");
    } else {
        document.getElementById("btn-next-slide").classList.remove("hidden");
        document.getElementById("btn-skip-intro").classList.remove("hidden");
        document.getElementById("btn-start-app").classList.add("hidden");
        document.getElementById("btn-start-app").classList.remove("flex");
    }
}

function nextSlide() {
    if (currentSlideIndex < slidesDOM.length - 1) {
        currentSlideIndex++;
        updateSlideUI();
    }
}
function tutupModalIntro() {
    document.getElementById("modalIntroSystem").classList.add("hidden");
    window.location.href = "dashboard.html";
}

function bukaModalAuth(tab = "login") {
    switchTabAuth(tab);
    document.getElementById("modalAuth").classList.remove("hidden");
    setTimeout(() => document.getElementById(tab === "login" ? "login-email" : "reg-nama").focus(), 50);
}
function tutupModalAuth() {
    document.getElementById("modalAuth").classList.add("hidden");
}
window.addEventListener("click", function (e) {
    const modal = document.getElementById("modalAuth");
    if (e.target === modal) tutupModalAuth();
});

function switchTabAuth(tab) {
    const isLogin = tab === "login";
    document.getElementById("form-login").classList.toggle("hidden", !isLogin);
    document.getElementById("form-daftar").classList.toggle("hidden", isLogin);

    const tabLogin = document.getElementById("tab-login");
    const tabDaftar = document.getElementById("tab-daftar");
    tabLogin.className = tabDaftar.className = "tab-auth";
    tabLogin.setAttribute("aria-selected", isLogin);
    tabDaftar.setAttribute("aria-selected", !isLogin);
    document.getElementById("judul-auth").textContent = isLogin ? "Masuk ke akunmu" : "Buat akun baru";
    document.getElementById("sub-auth").textContent = isLogin
        ? "Lanjutkan modul dan kumpulkan poinmu."
        : "Data diri dipakai untuk keperluan penelitian dan tidak ditampilkan ke peserta lain.";
}

async function prosesLogin() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login");
    if (!email || !password) return alert("Isi email dan kata sandi.");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Memeriksa…";
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.reload();
    } catch (e) {
        alert("Email atau kata sandi salah.");
        btn.disabled = false;
        btn.innerHTML = "Masuk";
    }
}

// PERBAIKAN LOGIKA: MENGGUNAKAN UPSERT
async function prosesDaftar() {
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const nama = document.getElementById("reg-nama").value;
    const gender = document.getElementById("reg-gender").value;
    const kategori = document.getElementById("reg-kategori").value;
    const kota = document.getElementById("reg-kota").value;
    const tglLahir = document.getElementById("reg-tgl-lahir").value; // format YYYY-MM-DD
    const btn = document.getElementById("btn-daftar");
    if (!email || !password || !nama || !kota || !tglLahir)
        return alert("Lengkapi semua kolom, termasuk tanggal lahir dan asal kota.");
    const usia = hitungUsia(tglLahir);
    if (usia === null || usia < 10 || usia > 90)
        return alert("Tanggal lahir belum sesuai. Periksa kembali tahun lahirmu.");
    if (password.length < 8) return alert("Kata sandi minimal 8 karakter.");
    btn.disabled = true;
    btn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Memproses...";
    try {
        // Data profil juga dikirim sebagai metadata agar trigger database tetap bisa
        // membuat profil walaupun "Confirm email" aktif (belum ada sesi login).
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { nama_lengkap: nama, jenis_kelamin: gender, kategori: kategori, kota: kota, tanggal_lahir: tglLahir },
            },
        });
        if (error) throw error;
        if (data.user) {
            // Menggunakan UPSERT agar tidak konflik dengan Database Trigger
            await supabaseClient
                .from("profiles")
                .upsert([
                    {
                        id: data.user.id,
                        nama_lengkap: nama,
                        jenis_kelamin: gender,
                        kategori: kategori,
                        kota: kota,
                        tanggal_lahir: tglLahir,
                        total_poin: 0,
                    },
                ]);
        }
        alert("Akun berhasil dibuat. Silakan masuk.");
        switchTabAuth("login");
        document.getElementById("login-email").value = email;
    } catch (e) {
        alert("Gagal mendaftar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Buat akun";
    }
}
