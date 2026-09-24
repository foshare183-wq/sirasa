-- =====================================================================
-- 02 - ROW LEVEL SECURITY
-- Jalankan SETELAH 01_admin_role.sql dan SETELAH akun peneliti dijadikan admin.
-- Aman dijalankan ulang.
--
-- PERHATIAN: bagian pertama MENGHAPUS semua policy lama di tabel
-- profiles, buku, kuis, dan riwayat_kuis agar tidak ada policy longgar
-- (misalnya "Enable read access for all users") yang tertinggal.
-- =====================================================================

do $$
declare pol record;
begin
    for pol in
        select policyname, tablename from pg_policies
        where schemaname = 'public'
          and tablename in ('profiles', 'buku', 'kuis', 'riwayat_kuis')
    loop
        execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
    end loop;
end $$;

alter table public.profiles      enable row level security;
alter table public.buku          enable row level security;
alter table public.kuis          enable row level security;
alter table public.riwayat_kuis  enable row level security;

-- ---------------------------------------------------------------------
-- PROFILES: pengguna hanya melihat/mengubah profilnya sendiri, admin semua
-- ---------------------------------------------------------------------
create policy "profil: baca milik sendiri atau admin" on public.profiles
    for select to authenticated
    using (id = auth.uid() or public.is_admin());

create policy "profil: buat milik sendiri" on public.profiles
    for insert to authenticated
    with check (id = auth.uid());

create policy "profil: ubah milik sendiri atau admin" on public.profiles
    for update to authenticated
    using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());

create policy "profil: hapus hanya admin" on public.profiles
    for delete to authenticated
    using (public.is_admin());

-- ---------------------------------------------------------------------
-- BUKU: semua pengguna login boleh membaca, hanya admin yang mengelola
-- ---------------------------------------------------------------------
create policy "buku: baca pengguna login" on public.buku
    for select to authenticated using (true);

create policy "buku: kelola hanya admin" on public.buku
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- KUIS: semua pengguna login boleh membaca soal, hanya admin mengelola
-- (Catatan: kunci jawaban masih ikut terbaca, lihat SECURITY.md tahap 3)
-- ---------------------------------------------------------------------
create policy "kuis: baca pengguna login" on public.kuis
    for select to authenticated using (true);

create policy "kuis: kelola hanya admin" on public.kuis
    for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- RIWAYAT KUIS: responden hanya menambah & melihat riwayatnya sendiri
-- ---------------------------------------------------------------------
create policy "riwayat: baca milik sendiri atau admin" on public.riwayat_kuis
    for select to authenticated
    using (id_user = auth.uid() or public.is_admin());

create policy "riwayat: tambah milik sendiri" on public.riwayat_kuis
    for insert to authenticated
    with check (id_user = auth.uid());

create policy "riwayat: ubah hanya admin" on public.riwayat_kuis
    for update to authenticated
    using (public.is_admin()) with check (public.is_admin());

create policy "riwayat: hapus hanya admin" on public.riwayat_kuis
    for delete to authenticated
    using (public.is_admin());

-- ---------------------------------------------------------------------
-- LEADERBOARD: hanya nama depan, kategori, dan poin yang dibuka ke publik
-- (profil lengkap responden lain tidak bisa dibaca langsung)
-- ---------------------------------------------------------------------
create or replace function public.get_leaderboard(jumlah int default 5)
returns table (nama_lengkap text, kategori text, total_poin numeric)
language sql
stable
security definer
set search_path = public
as $$
    select split_part(p.nama_lengkap, ' ', 1)::text,
           p.kategori::text,
           p.total_poin::numeric
    from public.profiles p
    where p.total_poin > 0 and p.role = 'user'
    order by p.total_poin desc
    limit least(greatest(jumlah, 1), 50);
$$;

revoke all on function public.get_leaderboard(int) from public;
grant execute on function public.get_leaderboard(int) to authenticated;

-- ---------------------------------------------------------------------
-- STORAGE: bucket pdf-buku, hanya admin yang boleh upload/ubah/hapus.
-- Bucket tetap "public" agar URL PDF & cover bisa dibuka pembaca.
-- Cek juga Storage > Policies di dashboard dan hapus policy lama
-- untuk bucket ini yang mengizinkan anon/authenticated menulis.
-- ---------------------------------------------------------------------
drop policy if exists "pdf-buku: upload admin" on storage.objects;
drop policy if exists "pdf-buku: ubah admin"   on storage.objects;
drop policy if exists "pdf-buku: hapus admin"  on storage.objects;

create policy "pdf-buku: upload admin" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'pdf-buku' and public.is_admin());

create policy "pdf-buku: ubah admin" on storage.objects
    for update to authenticated
    using (bucket_id = 'pdf-buku' and public.is_admin());

create policy "pdf-buku: hapus admin" on storage.objects
    for delete to authenticated
    using (bucket_id = 'pdf-buku' and public.is_admin());
