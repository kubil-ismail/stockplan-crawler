# Handoff: stockplan-crawler

Terakhir diperbarui: 2026-11-12

## Status

Repo belum punya commit; semua file masih untracked. Crawler IDX 1 sampai 9 sudah selesai. Crawler 10 (laporan keuangan) masih dikerjakan.

## Sedang dikerjakan: crawler 10 (`crawler/idx/10_company-financial-summary.js`)

Yang sudah jalan: membuka tab "Laporan Keuangan" untuk setiap emiten, lalu memilih tiap tahun di dropdown satu per satu.

Yang belum:
- Pemanggilan `downloadAuditedReports(page, code, year)` di dalam loop tahun masih di-comment, jadi **belum ada file yang diunduh**. Fungsinya sudah ditulis: pilih periode "Audit", lalu unduh semua dokumen di bagian "Unduh Laporan Keuangan Lainnya" ke `dist/idx/company/financial/{T}/{tahun}/{periode}/`.
- Pengecekan resume mencari `financial/{T}.json`, tapi crawler ini tidak pernah menulis file itu. Akibatnya setiap run mengulang semua emiten. Perlu penanda selesai per emiten, misalnya cek folder `{T}/` atau tulis `{T}.json` berisi daftar file yang sudah diunduh.
- Belum ada parser, belum ada tester, dan file minify belum ditulis.
- Selector `#vs2__listbox` / `#vs3__listbox` adalah ID buatan vue-select, jadi bisa berubah. Lebih aman mencari listbox dari dropdown induknya (`.latest-tw`, `.input-period`).
- `chromium.use(stealth())` dipanggil setiap kali `createSession`. Sebaiknya dipindah ke level modul supaya hanya dipanggil sekali.
- `headless: false`, jadi jendela browser akan muncul.

## Sync API (AdminSinkron), 2026-11-12

`lib/sync-agent.js` (dijalankan oleh `npm start` / `index.js`) mengambil job dari antrean backend, menjalankan crawler, lalu mengirim laporan. Pemetaan job:

| Job | Crawler |
|---|---|
| `prof`, `sub`, `mgmt` | 2 (satu kali jalan untuk ketiganya dalam satu putaran) |
| `px` | 6 |
| `idx` | 3 |
| `kip`, `lk`, `ipo` | belum ada crawler, dilaporkan gagal |

Belum dikerjakan:
- **`conflicts` tidak dikirim.** Data `group`, `shareholders`, `management` dari crawler 2 perlu dipetakan ke bentuk form emiten di backend (`validateForm` di `stockplan-backend/lib/adminCompanies.js`).
- **Run terjadwal** ("Harian 06.00") dan `nextRunAt` belum ada. Agent hanya menjalankan job yang dipicu admin.
- **Belum diuji dengan backend dan IDX sungguhan.** Yang sudah diuji: unit test dan server tiruan.
- **Crawler 2 memakai `headless: false`**, jadi akan gagal di server tanpa display.
- **Backend menganggap run mati setelah 2 jam.** Run penuh crawler 2 untuk ~950 emiten bisa mendekati batas itu.

## Bug yang diketahui (belum diperbaiki)

1. **`detectCloudflare` tidak didefinisikan** di crawler 4, 7, 8, 9 (crawler 3 sudah diperbaiki), padahal dipanggil di `catch` saat tabel tidak muncul. Akibatnya yang keluar `ReferenceError`, bukan "Blocked by Cloudflare". Perbaikan: salin fungsinya dari crawler 1.
2. **Crawler 10: percobaan ulang setelah browser dibuat ulang tidak dibungkus `try`**, dan `destroySession()` tidak di-`await`. Crawler 2 dan 6 sudah diperbaiki.
3. (sudah diperbaiki di crawler 2 dan 6, lihat poin 2)
4. **Progress bar crawler 5** hanya naik kalau tanggal itu ada datanya.
5. **Tester bisa crash.** Di `test/idx/1_*.test.js`, kalau file gagal dibaca, `validateJsonFile` mengembalikan `null`, lalu `.data` diakses dan melempar TypeError.
6. **Cache crawler satu halaman tidak punya masa berlaku.** Data seperti daftar emiten, screener, aksi korporasi, suspensi, dan UMA tidak akan diperbarui sampai file di `dist` dihapus manual.
7. **Jeda terlalu singkat setelah memilih "semua baris".** Crawler menunggu `waitForTimeout(100–500)` lalu langsung membaca tabel, jadi data bisa terpotong tanpa ada error. Lebih aman menunggu jumlah baris berhenti bertambah.
8. (sudah diperbaiki: `index.js` sekarang menjalankan agent sync)

## Belum dicek

- Parser `middleware/idx/2-9` dan tester `test/idx/2-6`. Yang sudah dibaca hanya parser dan tester untuk crawler 1.
- Crawler TradingView (`crawler/trading_view`) dan Yahoo Finance (`crawler/yf`).
- `lib/idx.js` (sesi persistent dengan verifikasi Cloudflare manual) belum dipakai oleh crawler mana pun. Kemungkinan disiapkan untuk mengatasi blokir.
- Belum ada crawler yang dijalankan sejak handoff ini ditulis.

## Langkah berikutnya yang disarankan

1. Perbaiki bug 1 dan 2. Perubahannya kecil dan mencegah crawler berhenti diam-diam.
2. Selesaikan crawler 10: aktifkan unduhan, perbaiki pengecekan resume, lalu uji dengan 1-2 ticker.
