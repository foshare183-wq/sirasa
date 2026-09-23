# KITA SEBAYA

Platform edukasi pencegahan HIV/AIDS berbasis gamifikasi: modul flipbook, pre-test/post-test, XP, dan papan peringkat. Dibuat untuk keperluan penelitian.

Situs: https://kitasebaya.biz.id (GitHub Pages) · Database & autentikasi: Supabase

## Struktur folder

```
.
├── index.html              Beranda + login/daftar
├── dashboard.html          Galeri modul & leaderboard
├── buku.html               Pembaca flipbook + kuis
├── profil.html             Profil & riwayat responden
├── admin/
│   ├── index.html          Panel admin (hanya role admin)
│   └── analitik.html       Analitik penelitian (hanya role admin)
├── assets/
│   ├── css/                base.css (bersama) + gaya khusus tiap halaman
│   ├── img/                Gambar (ilustrasi.png untuk hero beranda)
│   └── js/
│       ├── config.js       URL & anon key Supabase
│       ├── theme.js        Palet, huruf, dan radius (tema Tailwind bersama)
│       ├── common.js       Helper bersama (esc, requireAdmin, fetchAll, hitungUsia)
│       ├── dflip-config.js Konfigurasi flipbook
│       └── pages/          Logika per halaman
├── supabase/               SQL & Edge Function (tidak dipakai GitHub Pages,
│                           disimpan di repo sebagai dokumentasi/versi)
├── CNAME                   Domain kustom GitHub Pages
├── SECURITY.md             Hasil audit keamanan & langkah lanjutan
└── .gitignore
```

Panel admin kini ada di **`/admin/`** (sebelumnya `/admin.html`).

## Urutan pemasangan (penting)

Jalankan langkah Supabase **sebelum** push kode baru, karena halaman admin kini mewajibkan login sebagai admin.

1. **Supabase > SQL Editor:** jalankan `supabase/01_admin_role.sql`.
2. Jadikan akun peneliti admin (perintah `update ... set role = 'admin'` di bagian bawah file 01).
3. Jalankan `supabase/02_rls_policies.sql`.
4. Jalankan `supabase/03_perbaikan_skema.sql` (unduh cadangan data dulu).
5. **Supabase > Edge Functions:** deploy `supabase/functions/admin-update-user/index.ts` dengan nama `admin-update-user`.
6. **Matikan endpoint Google Apps Script lama** (lihat SECURITY.md poin 2).
7. Isi `assets/js/config.js` dengan URL project dan **anon key** (bukan service_role).
8. Taruh gambar hero di `assets/img/ilustrasi.png`.
9. Commit & push ke GitHub.

## Catatan config.js

`config.js` sengaja **tidak** dimasukkan ke `.gitignore`. GitHub Pages hanya menyajikan file yang ada di repo, jadi kalau file ini di-ignore situs tidak bisa terhubung ke Supabase. Anon key memang dirancang untuk publik; yang menjaga data adalah RLS. Yang tidak boleh ada di repo adalah **service_role key**.

## Ekspor data untuk SPSS

Buka **/admin/analitik.html → tab Data Item (SPSS)**. Tab ini menggantikan `dashpivot.html`.

1. Atur filter kota/tanggal di bagian atas bila perlu.
2. Pilih modul, lalu tentukan percobaan yang dipakai jika responden mengerjakan lebih dari sekali (pertama atau terakhir).
3. Pilih cakupan ekspor. **Semua modul** menaruh pre-test dan post-test dalam satu baris per responden (awalan `M1_`, `M2_`, …), siap untuk uji berpasangan.
4. Klik **Unduh data (.xlsx)** dan **Unduh sintaks label (.sps)**.
5. Di SPSS: *File → Import Data → Excel*, pilih lembar `Data`, centang "Read variable names from the first row". Lalu buka file .sps dan jalankan (*Run → All*) untuk memasang label variabel dan label nilai.

Aturan data: satu baris = satu responden, sel kosong = missing (bukan 0), kode responden (R0001, …) tetap sama di setiap ekspor, dan skor dihitung ulang dari jawaban mentah memakai kunci yang ada di database. Arti setiap kolom ada di lembar `Kamus Variabel`.

Pengodean: JK 1 = Laki-laki, 2 = Perempuan; KATEGORI 1 = Pelajar, 2 = Mahasiswa, 3 = Umum; KOTA sesuai lembar kamus.
