/**
 * sync-agent.js
 *
 * Menjalankan crawler saat admin menekan "Jalankan sekarang" / "Coba lagi" di AdminSinkron.
 * Ambil job dari antrean backend, jalankan crawler, kirim data profil (lib/push.js),
 * lalu laporkan hasil run per job. Kontrak: docs/CRAWLER_SYNC_PROMPT.md.
 *
 * Usage (lewat index.js):
 *   npm start                # loop, cek antrean tiap SYNC_INTERVAL detik
 *   SYNC_ONCE=1 npm start    # cek sekali lalu keluar
 *
 * Env (boleh di .env): BACKEND_URL, SYNC_TOKEN, SYNC_INTERVAL (detik, default 10)
 */

import companyList from "../crawler/idx/1_company-list-summary.js";
import companyDetail from "../crawler/idx/2_company-summary.js";
import screener from "../crawler/idx/3_company-screener-summary.js";
import tradingHistory from "../crawler/idx/6_company-trading-history-summary.js";
import { getQueue, reportRun } from "./backend.js";
import { pushCompanies } from "./push.js";

// Scrape profil lalu kirim filenya. ok = berhasil di-scrape dan tidak ditolak backend (invalid).
export async function detailAndPush(o, scrape = companyDetail, push = pushCompanies) {
  await companyList();
  const r = await scrape(o);
  const p = await push({ tickers: o.tickers ?? null });
  return {
    ...r,
    ok: r.scraped.filter((t) => !p.invalid.includes(t)).length,
    failures: [...r.failures, ...p.failures],
  };
}

// Crawler per emiten butuh dist/idx/company/company.json dari crawler 1.
export const RUNNERS = {
  detail: (o) => detailAndPush(o),
  history: async (o) => (await companyList(), tradingHistory(o)),
  screener: (o) => screener(o),
};

// Job key dari backend (migrations/20261112000003-create-sync.js) → runner.
// prof/mgmt/sub diisi dari satu scrape profil, jadi laporannya sama.
// shortcut: kip, lk, ipo belum punya crawler (crawler 10 belum mengunduh); px & idx belum punya endpoint data,
// jadi hanya status run-nya yang dilaporkan.
export const JOBS = {
  prof: "detail",
  sub: "detail",
  mgmt: "detail",
  px: "history",
  idx: "screener",
};

// Hasil crawler → { ok, total, failures }. Crawler per emiten sudah mengembalikan bentuk ini;
// crawler satu halaman mengembalikan { total, data }.
const toCounts = (r) =>
  Array.isArray(r?.failures)
    ? r
    : { ok: r?.total ?? null, total: r?.total ?? null, failures: [] };

/**
 * Jalankan satu job dan kembalikan body report.
 * cache dipakai ulang dalam satu putaran: prof/sub/mgmt memakai crawler yang sama, jadi cukup sekali jalan.
 */
export async function runJob(job, cache = new Map(), runners = RUNNERS) {
  const name = JOBS[job.key];

  if (!name) {
    const now = new Date();
    return {
      startedAt: now,
      finishedAt: now,
      tickers: job.tickers,
      ok: null,
      total: null,
      failures: [{ ticker: null, message: "Belum didukung crawler" }], // COPY: perlu review
    };
  }

  // Sudah diblokir IDX di putaran ini: job lain tidak mengakses IDX lagi, cukup dilaporkan gagal.
  const memo = cache.has("blocked") ? "blocked" : `${name}:${job.tickers?.join(",") ?? "*"}`;

  if (!cache.has(memo)) {
    cache.set(
      memo,
      (async () => {
        const startedAt = new Date();
        try {
          const r = toCounts(await runners[name]({ force: true, tickers: job.tickers ?? undefined }));
          return { startedAt, finishedAt: new Date(), ...r };
        } catch (err) {
          return {
            startedAt,
            finishedAt: new Date(),
            ok: null,
            total: null,
            blocked: !!err.hardBlock,
            failures: [{ ticker: null, message: err.message || String(err), log: String(err.stack ?? "").slice(0, 500) }],
          };
        }
      })()
    );
  }

  const { blocked, scraped, ...r } = await cache.get(memo);
  if (blocked) cache.set("blocked", Promise.resolve({ ...r, ok: null, total: null, blocked }));

  return {
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    tickers: job.tickers,
    ok: r.ok,
    total: r.total,
    failures: r.failures.slice(0, 2000).map((f) => ({
      ...f,
      message: String(f.message).slice(0, 200),
      ...(f.log && { log: String(f.log).slice(0, 500) }),
    })),
  };
}

// Jalankan job lalu laporkan; error laporan dicatat, tidak menghentikan job lain.
export async function runAndReport(jobs, cache = new Map()) {
  for (const job of jobs) {
    const report = await runJob(job, cache);
    try {
      const out = await reportRun(job.key, report);
      console.log(`✅ Report ${job.key}: ${report.ok ?? "-"}/${report.total ?? "-"} ok, ${out.failures} gagal`);
    } catch (err) {
      // Job tetap "running" di backend sampai timeout 2 jam, lalu bisa diambil lagi.
      console.error(`❌ Report ${job.key} gagal: ${err.message}`);
    }
  }
}

export async function tick() {
  const { jobs } = await getQueue();
  if (!jobs.length) return;

  console.log(`🔄 Sync: ${jobs.map((j) => j.key + (j.tickers ? `(${j.tickers.join(",")})` : "")).join(", ")}`);
  await runAndReport(jobs);
}

// Polling antrean terus-menerus; tick berikutnya baru dimulai setelah semua job tick ini selesai.
export async function startAgent() {
  if (!process.env.BACKEND_URL || !process.env.SYNC_TOKEN) {
    console.error("❌ Isi BACKEND_URL dan SYNC_TOKEN di .env (lihat .env.example).");
    process.exit(1);
  }

  const interval = Number(process.env.SYNC_INTERVAL || 10) * 1000;

  console.log(`👀 Menunggu job sinkron dari ${process.env.BACKEND_URL} (cek tiap ${interval / 1000} dtk)`);

  do {
    try {
      await tick();
    } catch (err) {
      console.error(`❌ Sync: ${err.message}`);
      // 401/403 = token salah: berhenti, jangan polling terus dengan token yang sama.
      if (err.status === 401 || err.status === 403) process.exit(1);
    }

    if (!process.env.SYNC_ONCE) await new Promise((r) => setTimeout(r, interval));
  } while (!process.env.SYNC_ONCE);
}
