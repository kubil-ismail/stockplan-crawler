/**
 * sync-agent.js
 *
 * Menjalankan crawler saat admin menekan "Jalankan sekarang" / "Coba lagi" di AdminSinkron.
 * Polling GET {SYNC_URL}/admin/api/sync/agent/queue, jalankan crawler per job,
 * lalu POST hasilnya ke /admin/api/sync/agent/jobs/:key/report.
 *
 * Usage (lewat index.js):
 *   npm start                # loop, cek antrean tiap SYNC_INTERVAL detik
 *   SYNC_ONCE=1 npm start    # cek sekali lalu keluar
 *
 * Env (boleh di .env):
 *   SYNC_URL       base URL backend, mis. http://localhost:3000
 *   SYNC_TOKEN     sama dengan SYNC_TOKEN di backend (≥ 32 karakter)
 *   SYNC_INTERVAL  detik antar polling, default 10
 */

import companyList from "../crawler/idx/1_company-list-summary.js";
import companyDetail from "../crawler/idx/2_company-summary.js";
import screener from "../crawler/idx/3_company-screener-summary.js";
import tradingHistory from "../crawler/idx/6_company-trading-history-summary.js";

// Crawler per emiten butuh dist/idx/company/company.json dari crawler 1.
export const RUNNERS = {
  detail: async (o) => (await companyList(), companyDetail(o)),
  history: async (o) => (await companyList(), tradingHistory(o)),
  screener: (o) => screener(o),
};

// Job key dari backend (migrations/20261112000003-create-sync.js) → runner.
// shortcut: kip, lk, ipo belum punya crawler (crawler 10 belum mengunduh); dilaporkan gagal sampai crawler-nya ada.
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
      failures: [{ message: `Crawler untuk job "${job.key}" belum tersedia.` }],
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
            failures: [{ message: err.message || String(err), log: String(err.stack ?? "").slice(0, 500) }],
          };
        }
      })()
    );
  }

  const { blocked, ...r } = await cache.get(memo);
  if (blocked) cache.set("blocked", Promise.resolve({ ...r, ok: null, total: null, blocked }));

  return {
    ...r,
    tickers: job.tickers,
    failures: r.failures.slice(0, 2000).map((f) => ({ ...f, message: String(f.message).slice(0, 200) })),
  };
}

async function api(method, path, body) {
  const res = await fetch(`${process.env.SYNC_URL.replace(/\/$/, "")}/admin/api/sync/agent${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.SYNC_TOKEN}`,
      "content-type": "application/json",
    },
    body: body && JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const e = data?.error;
    throw new Error(`${method} ${path} → ${res.status} ${e?.code ?? ""} ${JSON.stringify(e?.fields ?? e?.message ?? "")}`);
  }

  return data;
}

export async function tick() {
  const { jobs } = await api("GET", "/queue");
  if (!jobs.length) return;

  console.log(`🔄 Sync: ${jobs.map((j) => j.key + (j.tickers ? `(${j.tickers.join(",")})` : "")).join(", ")}`);

  const cache = new Map();

  for (const job of jobs) {
    const report = await runJob(job, cache);

    try {
      const out = await api("POST", `/jobs/${job.key}/report`, report);
      console.log(`✅ Report ${job.key}: ${report.ok ?? "-"}/${report.total ?? "-"} ok, ${out.failures} gagal`);
    } catch (err) {
      // Job tetap "running" di backend sampai timeout 2 jam, lalu bisa diambil lagi.
      console.error(`❌ Report ${job.key} gagal: ${err.message}`);
    }
  }
}

// Polling antrean terus-menerus; tick berikutnya baru dimulai setelah semua job tick ini selesai.
export async function startAgent() {
  if (!process.env.SYNC_URL || !process.env.SYNC_TOKEN) {
    console.error("❌ Isi SYNC_URL dan SYNC_TOKEN (env atau .env).");
    process.exit(1);
  }

  const interval = Number(process.env.SYNC_INTERVAL || 10) * 1000;

  console.log(`👀 Menunggu job sinkron dari ${process.env.SYNC_URL} (cek tiap ${interval / 1000} dtk)`);

  do {
    try {
      await tick();
    } catch (err) {
      // fetch menyembunyikan penyebab asli (mis. ECONNREFUSED = backend mati) di err.cause
      console.error(`❌ Sync: ${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ""}`);
    }

    if (!process.env.SYNC_ONCE) await new Promise((r) => setTimeout(r, interval));
  } while (!process.env.SYNC_ONCE);
}
