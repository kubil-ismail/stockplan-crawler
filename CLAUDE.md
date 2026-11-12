# stockplan-crawler

Scraper data saham Indonesia dari IDX, TradingView, dan Yahoo Finance. Node.js ESM (`"type": "module"`) dengan Playwright.

## Perintah

- `npm run build`: jalankan `lib/crawler.js` (menu interaktif @clack/prompts untuk memilih sumber dan data). Harus dijalankan dari root; script ini sendiri `cd lib`.
- `npm run export`: zip `dist/idx` ke `archive/idx-YYYY-MM-DD.zip`, lalu **menghapus** `dist/idx`.
- `npm start`: `index.js`, proses yang selalu hidup untuk agent `lib/sync-agent.js`. Mengecek antrean AdminSinkron di backend (`stockplan-backend`) tiap `SYNC_INTERVAL` detik (default 10), menjalankan crawler, lalu mengirim laporan. Butuh `SYNC_URL` dan `SYNC_TOKEN` (env atau `.env`); `SYNC_ONCE=1` untuk sekali jalan.
- `npm test`: `node --test test/*.test.js`.

`test/idx/*.test.js` bukan test runner: isinya validator yang dipanggil oleh crawler itu sendiri.

## Sync dengan backend

- Kontrak: `GET /admin/api/sync/agent/queue` mengklaim job `{ key, tickers }`, lalu `POST /admin/api/sync/agent/jobs/:key/report`. Sumber kebenarannya `stockplan-backend/lib/sync.js` (`validateReport`) dan `docs/openapi.js`.
- Pemetaan job → crawler ada di `JOBS` di `lib/sync-agent.js`. Agent memanggil crawler dengan `{ force: true, tickers }`. Crawler per emiten harus mengembalikan `{ ok, total, failures: [{ ticker, message }] }`.

## Struktur

```
crawler/idx/N_*.js        satu file per jenis data; nomor N = urutan
middleware/idx/N_*.parser.js   mengubah data mentah jadi versi minify (pasangan dengan crawler N)
test/idx/N_*.test.js      validasi file output (hanya ada untuk 1-6)
lib/crawler.js            runner menu; crawler IDX 1 selalu jalan lebih dulu
lib/migrate.js            createFolder, zipFolder
lib/idx.js                sesi persistent Chrome + verifikasi Cloudflare manual (belum dipakai crawler)
data/global/              referensi statis: sektor, industri, broker
middleware/archive, extractor/[archive]   kode lama, jangan disentuh kecuali diminta
dist/                     output (di-gitignore)
```

## Konvensi crawler IDX

- Setiap crawler meng-export `default async function main(options)`. `options.disableConsole` mematikan log.
- Setiap crawler menulis dua file: data mentah ke `dist/idx/<path>` dan hasil parser ke `dist/idx/minify/<path>`, keduanya dengan bentuk `{ total, data, scraped_at }`.
- **Cache berbasis file.** Crawler yang hanya mengambil satu halaman tidak akan scraping lagi kalau file outputnya sudah berisi data. Crawler per emiten (2, 6, 10) melewati ticker yang file `{TICKER}.json`-nya sudah ada. Untuk memaksa scraping ulang, hapus file di `dist`.
- Crawler per emiten membaca daftar ticker dari `dist/idx/company/company.json` (output crawler 1). Ticker yang panjangnya bukan 4 huruf, dan `MFIN`, selalu dilewati.
- Anti-bot: satu user-agent Chrome sesuai versi Chromium (`chromeUA`), viewport acak, `slowMo`, jeda 1,5–3 dtk antar emiten, `withRetry` 3 kali. Halaman blokir WAF ("Sorry, you have been blocked") dideteksi `assertNotHardBlocked` (`lib/helper.js`) dan menghentikan crawler tanpa retry; jangan tambahkan retry atau cara menembus blokir ini. Kalau 3 kali diblokir Cloudflare, crawler 1, 3, 4, 7, 8, 9 diulang dengan `headless: false` (`withHeadfulFallback` di `lib/helper.js`), dan crawler 6 membuat ulang sesinya dengan `headless: false`. Semua scraper Playwright mengimpor `chromium` dari `lib/browser.js` (playwright-extra + stealth, didaftarkan sekali); jangan impor `playwright` langsung.
- Helper seperti `withRetry`, `randomDelay`, `detectCloudflare`, `ensureFolder` disalin ke setiap file, tidak di-share. Kalau mengubah perilakunya, ubah di semua file yang memakainya.
- Fungsi scraping utama di setiap file bernama `scrapeCorporateAction`. Nama ini sisa copy-paste dan tidak ada hubungannya dengan corporate action.
- Halaman IDX berupa tabel vue-good-table: `select[name="perPageSelect"]` diisi `-1` supaya semua baris tampil, lalu baris dibaca dari `.vgt-boxed table tbody tr`.

## Menambah crawler baru

1. Salin crawler IDX yang paling mirip, beri nomor berikutnya.
2. Buat parser di `middleware/idx/`, dan validator di `test/idx/` kalau perlu.
3. Daftarkan di menu dan `switch` di `lib/crawler.js`.

Status pekerjaan dan bug yang belum diperbaiki ada di `HANDOFF.md`.
