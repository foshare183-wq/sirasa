-- =====================================================================
-- 01 - PERAN ADMIN
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
-- =====================================================================

-- 1. Kolom role di profiles (default: user biasa)
alter table public.profiles
    add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
    add constraint profiles_role_check check (role in ('user', 'admin'));

-- 2. Fungsi pengecek admin (dipakai oleh RLS, halaman admin, dan Edge Function)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Cegah pengguna biasa menjadikan dirinya admin
create or replace function public.lindungi_kolom_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- auth.uid() kosong = dijalankan dari SQL Editor / trigger sistem / service role
    if auth.uid() is null or public.is_admin() then
        return new;
    end if;

    if tg_op = 'INSERT' then
        new.role := 'user';
    elsif new.role is distinct from old.role then
        raise exception 'Tidak diizinkan mengubah role';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_lindungi_kolom_profil on public.profiles;
create trigger trg_lindungi_kolom_profil
    before insert or update on public.profiles
    for each row execute function public.lindungi_kolom_profil();

-- 4. Tolak karakter < dan > pada teks profil (lapisan tambahan anti-XSS).
--    NOT VALID = data lama tidak diperiksa, hanya data baru/yang diubah.
alter table public.profiles drop constraint if exists profiles_teks_aman;
alter table public.profiles
    add constraint profiles_teks_aman check (
        coalesce(nama_lengkap, '')  !~ '[<>]' and
        coalesce(kota, '')          !~ '[<>]' and
        coalesce(kategori, '')      !~ '[<>]' and
        coalesce(jenis_kelamin, '') !~ '[<>]'
    ) not valid;

-- =====================================================================
-- 5. JADIKAN AKUN PENELITI SEBAGAI ADMIN
--    Daftar dulu lewat halaman utama situs, lalu ganti email di bawah
--    dan jalankan baris ini:
-- =====================================================================
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'email.peneliti@contoh.com');
