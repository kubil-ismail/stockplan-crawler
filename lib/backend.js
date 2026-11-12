/**
 * Client ke backend StockPlan (Sinkron data BEI). Kontrak: docs/CRAWLER_SYNC_PROMPT.md dan Swagger
 * backend (/docs, tag "Admin: Sinkron").
 *
 * Env: BACKEND_URL (mis. http://localhost:3000), SYNC_TOKEN (sama persis dengan backend).
 * Token tidak pernah masuk ke pesan error atau log.
 */

const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
export const RETRY_DELAY_MS = { value: 1000 }; // dikecilkan di test

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function config() {
  const url = process.env.BACKEND_URL;
  const token = process.env.SYNC_TOKEN;
  if (!url || !token) throw new Error("Isi BACKEND_URL dan SYNC_TOKEN di .env (lihat .env.example).");
  return { url: url.replace(/\/$/, ""), token };
}

// Retry 3x untuk 5xx, timeout, dan error jaringan. 4xx (token salah, validasi) langsung gagal.
async function request(method, path, body) {
  const { url, token } = config();

  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${url}/admin/api/sync/agent${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      // fetch menyembunyikan penyebab asli (ECONNREFUSED = backend mati) di err.cause
      const reason = err.cause?.code ?? err.cause?.message ?? err.name;
      if (attempt >= ATTEMPTS) throw new Error(`${method} ${path}: backend tidak bisa dihubungi (${reason})`);
      await sleep(RETRY_DELAY_MS.value * attempt);
      continue;
    }

    const data = await res.json().catch(() => null);
    if (res.ok) return data;

    const e = data?.error;
    const err = new Error(`${method} ${path} → ${res.status} ${e?.code ?? ""} ${JSON.stringify(e?.fields ?? e?.message ?? "")}`);
    err.status = res.status;
    if (res.status < 500 || attempt >= ATTEMPTS) throw err;
    await sleep(RETRY_DELAY_MS.value * attempt);
  }
}

export const getQueue = () => request("GET", "/queue");
export const postCompanies = (items) => request("POST", "/companies", { data: items });
export const reportRun = (key, payload) => request("POST", `/jobs/${key}/report`, payload);
