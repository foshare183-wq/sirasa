// Tab "Data item (SPSS)" di admin/analitik.html
//
// Menyusun skor per butir soal untuk setiap responden (format lebar:
// satu baris = satu responden) yang siap diimpor ke SPSS, lengkap dengan
// lembar kamus variabel dan sintaks label (.sps).
//
// Memakai data global dari analitik.js: rawProfiles, rawBuku, filteredRiwayat.
// Karena itu tab ini otomatis mengikuti filter kota & tanggal di atas.

let itemKuis = null; // seluruh soal, dimuat saat tab pertama kali dibuka
let itemModulAktif = null;
let itemDimAktif = "__semua";
let itemHalaman = 1;
const ITEM_PER_HALAMAN = 15;

const KODE_JK = { "Laki-laki": 1, Perempuan: 2 };
const KODE_KATEGORI = { Pelajar: 1, Mahasiswa: 2, Umum: 3 };
const URUTAN_KOTA = ["Ternate", "Palembang", "Semarang"];

// ------------------------------------------------------------------
// Pemuatan & kontrol
// ------------------------------------------------------------------
async function bukaTabItem() {
    if (!itemKuis) {
        const wadah = document.getElementById("item-tabel");
        wadah.innerHTML = '<p class="p-8 text-sm text-slate-500">Memuat daftar soal…</p>';
        try {
            itemKuis = await fetchAll(() =>
                supabaseClient
                    .from("kuis")
                    .select("id, id_buku, pertanyaan, dimensi, opsi_jawaban, jawaban_benar, poin_reward")
                    .order("id", { ascending: true }),
            );
        } catch (err) {
            wadah.innerHTML = `<p class="p-8 text-sm text-rose-600">Soal gagal dimuat: ${esc(err.message)}. Muat ulang halaman untuk mencoba lagi.</p>`;
            return;
        }
    }
    renderPilihanModul();
    segarkanTabItem();
}

function modulBerkuis() {
    const adaSoal = new Set(itemKuis.map((k) => k.id_buku));
    return rawBuku.filter((b) => adaSoal.has(b.id));
}

function renderPilihanModul() {
    const wadah = document.getElementById("item-modul");
    const daftar = modulBerkuis();
    if (daftar.length === 0) {
        wadah.innerHTML = '<p class="text-sm text-slate-500">Belum ada modul yang memiliki soal.</p>';
        return;
    }
    if (!itemModulAktif || !daftar.some((b) => b.id === itemModulAktif)) itemModulAktif = daftar[0].id;
    wadah.innerHTML = daftar
        .map((b) => {
            const aktif = b.id === itemModulAktif;
            return `<button type="button" onclick="pilihModulItem('${b.id}')" aria-pressed="${aktif}"
                class="shrink-0 px-4 py-2 text-sm rounded-full border transition ${
                    aktif
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                }">${esc(b.judul)}</button>`;
        })
        .join("");
}

function pilihModulItem(id) {
    itemModulAktif = id;
    itemDimAktif = "__semua";
    itemHalaman = 1;
    renderPilihanModul();
    segarkanTabItem();
}

function pilihDimItem(kode) {
    itemDimAktif = kode;
    itemHalaman = 1;
    segarkanTabItem();
}

function gantiHalamanItem(h) {
    itemHalaman = h;
    segarkanTabItem();
}

function modeItem() {
    return document.getElementById("item-mode").value; // "pertama" | "terakhir"
}

function sertakanNama() {
    return document.getElementById("item-nama").checked;
}

// ------------------------------------------------------------------
// Pengolahan data
// ------------------------------------------------------------------

/** Skor satu jawaban, sama persis dengan cara buku.js menilai. */
function skorJawaban(soal, pilihan) {
    if (!soal.opsi_jawaban || pilihan === undefined || pilihan === null) return null;
    const opsi = soal.opsi_jawaban[pilihan];
    if (opsi === undefined) return null;
    if (typeof opsi === "string") return pilihan === soal.jawaban_benar ? soal.poin_reward || 1 : 0;
    return parseInt(opsi.poin || 0, 10);
}

/** Kode responden stabil (R0001, R0002, …) berdasarkan urutan pendaftaran. */
function petaKodeResponden() {
    const urut = [...rawProfiles].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const peta = {};
    urut.forEach((p, i) => (peta[p.id] = "R" + String(i + 1).padStart(4, "0")));
    return peta;
}

function petaKodeKota() {
    const semua = [...new Set(rawProfiles.map((p) => p.kota).filter(Boolean))];
    const urut = [
        ...URUTAN_KOTA.filter((k) => semua.includes(k)),
        ...semua.filter((k) => !URUTAN_KOTA.includes(k)).sort(),
    ];
    const peta = {};
    urut.forEach((k, i) => (peta[k] = i + 1));
    return peta;
}

/**
 * Menyusun struktur satu modul:
 * { dimensi: [{ kode, nama, soal: [{ id, kode, pertanyaan }] }], responden: [...] }
 */
function susunDataModul(idBuku, mode) {
    const soalModul = itemKuis.filter((k) => k.id_buku === idBuku);
    const petaSoal = {};
    const dimensi = [];
    soalModul.forEach((s) => {
        const nama = s.dimensi || "Umum";
        let d = dimensi.find((x) => x.nama === nama);
        if (!d) {
            d = { kode: "D" + (dimensi.length + 1), nama, soal: [] };
            dimensi.push(d);
        }
        const item = { id: String(s.id), kode: `${d.kode}_Q${d.soal.length + 1}`, pertanyaan: s.pertanyaan, dim: d.kode, ref: s };
        d.soal.push(item);
        petaSoal[item.id] = item;
    });

    const petaProfil = {};
    rawProfiles.forEach((p) => (petaProfil[p.id] = p));

    const riwayat = filteredRiwayat
        .filter((r) => r.id_buku === idBuku && r.detail_jawaban && Object.keys(r.detail_jawaban).length > 0)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const perUser = {};
    riwayat.forEach((r) => {
        const u = (perUser[r.id_user] ||= { idUser: r.id_user, jawaban: {}, waktu: null, durasi: null });
        let dipakai = false;
        for (const [idSoal, pilihan] of Object.entries(r.detail_jawaban)) {
            const item = petaSoal[idSoal];
            if (!item) continue;
            if (mode === "pertama" && u.jawaban[idSoal]) continue;
            u.jawaban[idSoal] = { pilihan, skor: skorJawaban(item.ref, pilihan) };
            dipakai = true;
        }
        if (dipakai && (mode === "terakhir" || !u.waktu)) {
            u.waktu = r.created_at;
            u.durasi = r.durasi_baca_detik;
        }
    });

    const kodeResp = petaKodeResponden();
    const responden = Object.values(perUser)
        .map((u) => {
            const p = petaProfil[u.idUser] || {};
            const skorDim = {};
            let total = 0;
            dimensi.forEach((d) => {
                let jml = 0;
                let ada = false;
                d.soal.forEach((s) => {
                    const j = u.jawaban[s.id];
                    if (j && j.skor !== null) {
                        jml += j.skor;
                        ada = true;
                    }
                });
                skorDim[d.kode] = ada ? jml : null;
                if (ada) total += jml;
            });
            return { ...u, profil: p, kode: kodeResp[u.idUser] || "-", skorDim, total };
        })
        .sort((a, b) => a.kode.localeCompare(b.kode));

    return { dimensi, responden };
}

// ------------------------------------------------------------------
// Tampilan
// ------------------------------------------------------------------
function segarkanTabItem() {
    if (!itemKuis || !itemModulAktif) return;
    const data = susunDataModul(itemModulAktif, modeItem());
    const { dimensi, responden } = data;

    // Ringkasan
    const jmlSoal = dimensi.reduce((n, d) => n + d.soal.length, 0);
    document.getElementById("item-ringkasan").textContent =
        `${responden.length} responden, ${dimensi.length} dimensi, ${jmlSoal} butir soal`;

    // Tab dimensi
    const tombol = [{ kode: "__semua", nama: "Semua dimensi" }, ...dimensi];
    if (!tombol.some((t) => t.kode === itemDimAktif)) itemDimAktif = "__semua";
    document.getElementById("item-dimensi").innerHTML = tombol
        .map((t) => {
            const aktif = t.kode === itemDimAktif;
            return `<button type="button" onclick="pilihDimItem('${t.kode}')" aria-pressed="${aktif}"
                class="shrink-0 px-3 py-2 text-sm border-b-2 transition ${
                    aktif ? "border-teal-700 text-slate-900 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
                }">${t.kode === "__semua" ? "" : `<span class="text-slate-400 mr-1">${t.kode}</span>`}${esc(t.nama)}</button>`;
        })
        .join("");

    const dimTampil = itemDimAktif === "__semua" ? dimensi : dimensi.filter((d) => d.kode === itemDimAktif);
    const wadah = document.getElementById("item-tabel");

    if (responden.length === 0) {
        wadah.innerHTML =
            '<p class="p-10 text-center text-sm text-slate-500">Belum ada jawaban untuk modul ini pada filter yang dipilih. Ubah filter kota atau tanggal di atas, atau pilih modul lain.</p>';
        return;
    }

    const totalHal = Math.max(1, Math.ceil(responden.length / ITEM_PER_HALAMAN));
    itemHalaman = Math.min(itemHalaman, totalHal);
    const mulai = (itemHalaman - 1) * ITEM_PER_HALAMAN;
    const halaman = responden.slice(mulai, mulai + ITEM_PER_HALAMAN);
    const denganNama = sertakanNama();

    const th = "px-3 py-2.5 font-semibold text-left whitespace-nowrap";
    let html = `<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">
        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200"><tr>
            <th class="${th} sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Responden</th>
            <th class="${th}">Usia</th><th class="${th}">L/P</th><th class="${th}">Kategori</th><th class="${th}">Kota</th>
            <th class="${th}">Waktu</th>`;
    dimTampil.forEach((d) => {
        d.soal.forEach((s) => {
            html += `<th class="${th} text-center" title="${esc(s.pertanyaan)}">${s.kode}</th>`;
        });
        html += `<th class="${th} text-center bg-slate-100">Skor ${d.kode}</th>`;
    });
    if (itemDimAktif === "__semua") html += `<th class="${th} text-center bg-teal-50 text-teal-800">Total</th>`;
    html += `</tr></thead><tbody class="divide-y divide-slate-100">`;

    const kosong = '<span class="text-slate-300">–</span>';
    halaman.forEach((r) => {
        const p = r.profil;
        const usia = hitungUsia(p.tanggal_lahir, r.waktu);
        html += `<tr class="hover:bg-slate-50">
            <td class="px-3 py-2.5 sticky left-0 bg-white border-r border-slate-100 whitespace-nowrap">
                <span class="font-semibold text-slate-800">${r.kode}</span>
                ${denganNama ? `<span class="block text-xs text-slate-500">${esc(p.nama_lengkap || "-")}</span>` : ""}
            </td>
            <td class="px-3 py-2.5">${usia ?? kosong}</td>
            <td class="px-3 py-2.5">${p.jenis_kelamin === "Laki-laki" ? "L" : p.jenis_kelamin === "Perempuan" ? "P" : kosong}</td>
            <td class="px-3 py-2.5">${esc(p.kategori || "") || kosong}</td>
            <td class="px-3 py-2.5">${esc(p.kota || "") || kosong}</td>
            <td class="px-3 py-2.5 whitespace-nowrap text-slate-500">${formatWaktuItem(r.waktu)}</td>`;
        dimTampil.forEach((d) => {
            d.soal.forEach((s) => {
                const j = r.jawaban[s.id];
                html += `<td class="px-3 py-2.5 text-center">${j && j.skor !== null ? j.skor : kosong}</td>`;
            });
            html += `<td class="px-3 py-2.5 text-center font-semibold bg-slate-50">${r.skorDim[d.kode] ?? kosong}</td>`;
        });
        if (itemDimAktif === "__semua") html += `<td class="px-3 py-2.5 text-center font-semibold text-teal-800 bg-teal-50/60">${r.total}</td>`;
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-sm text-slate-600">
        <span>${mulai + 1}–${Math.min(mulai + ITEM_PER_HALAMAN, responden.length)} dari ${responden.length}</span>
        <div class="flex items-center gap-2">
            <button type="button" onclick="gantiHalamanItem(${itemHalaman - 1})" ${itemHalaman === 1 ? "disabled" : ""}
                class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400">Sebelumnya</button>
            <span class="px-1">${itemHalaman} / ${totalHal}</span>
            <button type="button" onclick="gantiHalamanItem(${itemHalaman + 1})" ${itemHalaman === totalHal ? "disabled" : ""}
                class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-400">Berikutnya</button>
        </div>
    </div>`;

    wadah.innerHTML = html;
}

function formatWaktuItem(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const dua = (n) => String(n).padStart(2, "0");
    return `${dua(d.getDate())}/${dua(d.getMonth() + 1)}/${d.getFullYear()} ${dua(d.getHours())}:${dua(d.getMinutes())}`;
}

function formatWaktuIso(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const dua = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())} ${dua(d.getHours())}:${dua(d.getMinutes())}`;
}

// ------------------------------------------------------------------
// Ekspor SPSS
// ------------------------------------------------------------------

/**
 * Membangun dataset lebar + kamus variabel.
 * cakupan: "modul" (modul terpilih) atau "semua" (semua modul berkuis, diberi awalan M1_, M2_, …)
 */
function bangunDatasetSpss(cakupan) {
    const mode = modeItem();
    const denganNama = sertakanNama();
    const kodeKota = petaKodeKota();
    const daftarModul =
        cakupan === "semua" ? modulBerkuis() : modulBerkuis().filter((b) => b.id === itemModulAktif);

    const kamus = [
        { nama: "KODE", label: "Kode responden", tipe: "string" },
        ...(denganNama ? [{ nama: "NAMA", label: "Nama lengkap responden", tipe: "string" }] : []),
        { nama: "TGL_LAHIR", label: "Tanggal lahir (YYYY-MM-DD)", tipe: "string" },
        { nama: "JK", label: "Jenis kelamin", tipe: "nominal", nilai: { 1: "Laki-laki", 2: "Perempuan" } },
        { nama: "KATEGORI", label: "Kategori responden", tipe: "nominal", nilai: { 1: "Pelajar", 2: "Mahasiswa", 3: "Umum" } },
        {
            nama: "KOTA",
            label: "Asal kota",
            tipe: "nominal",
            nilai: Object.fromEntries(Object.entries(kodeKota).map(([k, v]) => [v, k])),
        },
    ];

    const baris = {}; // idUser -> objek baris
    const kodeResp = petaKodeResponden();
    const petaProfil = {};
    rawProfiles.forEach((p) => (petaProfil[p.id] = p));

    const barisUntuk = (idUser) => {
        if (!baris[idUser]) {
            const p = petaProfil[idUser] || {};
            baris[idUser] = {
                KODE: kodeResp[idUser] || "-",
                ...(denganNama ? { NAMA: p.nama_lengkap || "" } : {}),
                TGL_LAHIR: p.tanggal_lahir || null,
                JK: KODE_JK[p.jenis_kelamin] ?? null,
                KATEGORI: KODE_KATEGORI[p.kategori] ?? null,
                KOTA: kodeKota[p.kota] ?? null,
            };
        }
        return baris[idUser];
    };

    daftarModul.forEach((modul, idx) => {
        const awal = cakupan === "semua" ? `M${idx + 1}_` : "";
        const judulSingkat = cakupan === "semua" ? `[M${idx + 1}] ` : "";
        const { dimensi, responden } = susunDataModul(modul.id, mode);

        kamus.push(
            { nama: `${awal}TGL`, label: `${judulSingkat}Waktu pengerjaan ${modul.judul}`, tipe: "string" },
            { nama: `${awal}USIA`, label: `${judulSingkat}Usia saat mengerjakan (tahun)`, tipe: "scale" },
            { nama: `${awal}DURASI`, label: `${judulSingkat}Durasi pengerjaan (detik)`, tipe: "scale" },
        );
        dimensi.forEach((d) => {
            d.soal.forEach((s) =>
                kamus.push({ nama: awal + s.kode, label: `${judulSingkat}${d.nama}: ${s.pertanyaan}`, tipe: "scale" }),
            );
            kamus.push({ nama: `${awal}SKOR_${d.kode}`, label: `${judulSingkat}Skor dimensi ${d.nama}`, tipe: "scale" });
        });
        kamus.push({ nama: `${awal}TOTAL`, label: `${judulSingkat}Skor total ${modul.judul}`, tipe: "scale" });

        responden.forEach((r) => {
            const row = barisUntuk(r.idUser);
            row[`${awal}TGL`] = formatWaktuIso(r.waktu);
            row[`${awal}USIA`] = hitungUsia(r.profil.tanggal_lahir, r.waktu);
            row[`${awal}DURASI`] = r.durasi ?? null;
            dimensi.forEach((d) => {
                d.soal.forEach((s) => {
                    const j = r.jawaban[s.id];
                    row[awal + s.kode] = j && j.skor !== null ? j.skor : null;
                });
                row[`${awal}SKOR_${d.kode}`] = r.skorDim[d.kode];
            });
            row[`${awal}TOTAL`] = r.total;
        });
    });

    const namaKolom = kamus.map((k) => k.nama);
    const data = Object.values(baris).sort((a, b) => a.KODE.localeCompare(b.KODE));
    return { kamus, namaKolom, data, daftarModul, mode };
}

function namaBerkasSpss(cakupan, ekstensi) {
    const tgl = new Date().toISOString().slice(0, 10);
    if (cakupan === "semua") return `KitaSebaya_SemuaKuis_${tgl}.${ekstensi}`;
    const modul = rawBuku.find((b) => b.id === itemModulAktif);
    const judul = (modul ? modul.judul : "Modul").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
    return `KitaSebaya_${judul}_${tgl}.${ekstensi}`;
}

function unduhExcelSpss(cakupan) {
    if (!itemKuis) return;
    const { kamus, namaKolom, data, daftarModul, mode } = bangunDatasetSpss(cakupan);
    if (data.length === 0) return alert("Tidak ada jawaban pada filter yang dipilih, jadi belum ada yang bisa diunduh.");

    const wb = XLSX.utils.book_new();

    // Lembar 1: data (baris pertama = nama variabel SPSS, sel kosong = missing)
    const aoa = [namaKolom, ...data.map((row) => namaKolom.map((k) => (row[k] === undefined ? null : row[k])))];
    const wsData = XLSX.utils.aoa_to_sheet(aoa);
    wsData["!cols"] = namaKolom.map((k) => ({ wch: Math.max(8, k.length + 2) }));
    XLSX.utils.book_append_sheet(wb, wsData, "Data");

    // Lembar 2: kamus variabel
    const aoaKamus = [["Variabel", "Label", "Tipe", "Nilai"]];
    kamus.forEach((k) =>
        aoaKamus.push([
            k.nama,
            k.label,
            k.tipe,
            k.nilai ? Object.entries(k.nilai).map(([v, l]) => `${v} = ${l}`).join("; ") : "",
        ]),
    );
    const wsKamus = XLSX.utils.aoa_to_sheet(aoaKamus);
    wsKamus["!cols"] = [{ wch: 16 }, { wch: 80 }, { wch: 10 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsKamus, "Kamus Variabel");

    // Lembar 3: keterangan
    const filterKota = document.getElementById("filter-kota").value;
    const fStart = document.getElementById("filter-start").value;
    const fEnd = document.getElementById("filter-end").value;
    const info = [
        ["Diekspor", new Date().toLocaleString("id-ID")],
        ["Percobaan yang dipakai", mode === "pertama" ? "Percobaan pertama tiap responden" : "Percobaan terakhir tiap responden"],
        ["Filter kota", filterKota],
        ["Filter tanggal", fStart || fEnd ? `${fStart || "…"} s.d. ${fEnd || "…"}` : "Tidak ada"],
        ["Jumlah responden", data.length],
        ["Sel kosong", "Tidak menjawab / tidak mengerjakan (missing), bukan nol"],
        [],
        ["Kode modul", "Judul"],
        ...daftarModul.map((m, i) => [cakupan === "semua" ? `M${i + 1}` : "-", m.judul]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Keterangan");

    XLSX.writeFile(wb, namaBerkasSpss(cakupan, "xlsx"));
}

function unduhSintaksSpss(cakupan) {
    if (!itemKuis) return;
    const { kamus } = bangunDatasetSpss(cakupan);
    const kutip = (t) => "'" + String(t).replace(/'/g, "''").replace(/\s+/g, " ").slice(0, 250) + "'";

    let sps = `* Sintaks SPSS - KITA SEBAYA.\n`;
    sps += `* Jalankan setelah mengimpor ${namaBerkasSpss(cakupan, "xlsx")} (lembar "Data").\n`;
    sps += `* Dibuat ${new Date().toLocaleString("id-ID")}.\n\n`;

    sps += "VARIABLE LABELS\n";
    sps += kamus.map((k, i) => `  ${i === 0 ? "" : "/"}${k.nama} ${kutip(k.label)}`).join("\n") + " .\n\n";

    const bernilai = kamus.filter((k) => k.nilai && Object.keys(k.nilai).length);
    if (bernilai.length) {
        sps += "VALUE LABELS\n";
        sps +=
            bernilai
                .map(
                    (k, i) =>
                        `  ${i === 0 ? "" : "/"}${k.nama} ` +
                        Object.entries(k.nilai).map(([v, l]) => `${v} ${kutip(l)}`).join(" "),
                )
                .join("\n") + " .\n\n";
    }

    const nominal = kamus.filter((k) => k.tipe === "nominal").map((k) => k.nama);
    const skala = kamus.filter((k) => k.tipe === "scale").map((k) => k.nama);
    const baris = (arr) => arr.reduce((acc, n, i) => acc + (i && i % 8 === 0 ? "\n    " : " ") + n, "");
    if (nominal.length) sps += `VARIABLE LEVEL${baris(nominal)} (NOMINAL).\n`;
    if (skala.length) sps += `VARIABLE LEVEL${baris(skala)} (SCALE).\n`;
    sps += "EXECUTE.\n";

    const blob = new Blob([sps], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = namaBerkasSpss(cakupan, "sps");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function cakupanEkspor() {
    return document.getElementById("item-cakupan").value;
}
