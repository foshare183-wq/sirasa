# Audit Keamanan KITA SEBAYA

Status: ✅ sudah diperbaiki di kode ini · ⚙️ perlu tindakan di Supabase/Google · ⏳ tahap berikutnya

## Kritis

### 1. Panel admin & analitik bisa dibuka siapa saja ✅ ⚙️
`admin.html` dan `analitik.html` lama tidak memeriksa login sama sekali. Siapa pun yang membuka URL-nya bisa melihat, mengubah, dan menghapus data responden, modul, dan soal. Karena halaman itu bisa bekerja hanya dengan anon key, artinya database juga bisa diakses langsung lewat API oleh siapa pun yang membaca `config.js`, tanpa perlu membuka halaman admin.

Perbaikan: halaman admin memanggil `requireAdmin()`, dan yang terpenting, RLS di `02_rls_policies.sql` membatasi akses di level database.

### 2. Endpoint Google Apps Script bisa mengganti password akun siapa pun ⚙️
`admin.html` lama memanggil URL Google Apps Script dengan `{ id, updates: { email, password } }` tanpa verifikasi pemanggil. URL itu terlihat di situs dan tersimpan di riwayat git, sehingga siapa pun bisa mengambil alih akun mana pun, termasuk akun admin.

Tindakan segera:
1. Buka project Apps Script > **Deploy > Manage deployments > Archive** deployment tersebut.
2. Jika service_role key tersimpan di skrip itu atau pernah dibagikan ke orang lain, **rotasi** di Supabase > Project Settings > API.

Penggantinya adalah Edge Function `admin-update-user` yang memverifikasi bahwa pemanggil adalah admin.

## Tinggi

### 3. Data pribadi responden terbuka ✅ ⚙️
Tanpa RLS, nama, gender, kota, dan seluruh jawaban responden bisa diunduh siapa pun. Setelah `02_rls_policies.sql`, responden hanya bisa membaca datanya sendiri, dan leaderboard memakai fungsi `get_leaderboard` yang hanya membuka nama depan, kategori, dan poin.

### 4. Stored XSS lewat nama pengguna ✅
Nama, kota, dan kategori dimasukkan ke `innerHTML` tanpa di-escape. Responden bisa mengisi nama berisi kode HTML/JS yang akan berjalan di browser admin saat membuka panel, lalu mencuri sesi admin. Perbaikan: fungsi `esc()` di `common.js` dan constraint database yang menolak `<` `>`.

### 5. Skor kuis bisa dimanipulasi ⏳
Ini penting untuk validitas data penelitian:
- Poin setiap opsi ditulis di HTML (`data-poin`) dan kunci jawaban ikut terbaca dari tabel `kuis`, sehingga jawaban benar terlihat lewat DevTools.
- Skor dihitung di browser, lalu `total_poin` di-update langsung dari browser. Responden bisa mengirim nilai berapa pun.
- Kuis bisa diulang tanpa batas untuk menumpuk XP.

Dampaknya ke data penelitian terbatas: ekspor SPSS menghitung ulang skor dari pilihan jawaban mentah (`detail_jawaban`) memakai kunci di tabel `kuis`, bukan dari poin yang dikirim browser. Yang masih bisa dimanipulasi adalah XP/leaderboard dan tampilan kunci jawaban.

Solusi lanjutan: penilaian dipindah ke fungsi database (RPC) yang menerima jawaban mentah, menghitung skor di server, dan hanya memberi XP sekali per modul. Kolom `total_poin` lalu dikunci agar tidak bisa diubah dari browser.

## Sedang

### 6. Pengguna bisa menjadikan dirinya admin ✅
Dicegah oleh trigger `lindungi_kolom_profil` di `01_admin_role.sql`.

### 7. Hapus pengguna tidak menghapus akunnya
`hapusUser()` hanya menghapus baris `profiles`; akun di Supabase Auth tetap ada dan masih bisa login. Bisa ditambahkan ke Edge Function nanti.

### 8. Pengaturan Supabase Auth ⚙️
Di Authentication > Providers/Settings, disarankan panjang password minimal 8, aktifkan *Leaked password protection*, dan pastikan *Confirm email* sesuai kebutuhan penelitian.

## Rendah

- `cdn.tailwindcss.com` adalah Play CDN yang tidak ditujukan untuk produksi. Masih berfungsi, tetapi idealnya diganti build Tailwind statis.
- Versi Chart.js sudah dikunci ke 4.4.1 agar tidak rusak saat ada rilis mayor baru.
- ✅ Tanggal lahir kini dikumpulkan saat daftar, dan usia dihitung tepat pada tanggal pengerjaan tes.
- ✅ Analitik mengambil seluruh baris data. Sebelumnya dibatasi 1.000 baris oleh Supabase sehingga data di atas itu hilang tanpa peringatan.
- File ekspor data responden (`.xlsx`, `.csv`) sudah dimasukkan ke `.gitignore` agar tidak ter-commit ke repo publik.
