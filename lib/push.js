/**
 * Kirim file minify crawler 2 (dist/idx/minify/company/detail/{T}.json) ke backend apa adanya.
 * Backend yang memetakan ke form emiten: menulis langsung, membuat kartu tinjauan untuk bagian
 * milik tim, atau melewati ticker yang belum ada di database (unknown).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { postCompanies } from "./backend.js";
import { chunk } from "./helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MINIFY_DETAIL_DIR = path.join(__dirname, "..", "dist", "idx", "minify", "company", "detail");

const BATCH = 50; // backend: maks. 100 emiten per request

/**
 * tickers = null → semua file yang ada.
 * Return { counts, invalid: [ticker], failures: [{ ticker, message, log }] }.
 * File rusak dan emiten `invalid` dicatat sebagai failure, tidak menghentikan proses.
 */
export async function pushCompanies({ tickers = null, dir = MINIFY_DETAIL_DIR, post = postCompanies, log = console.log } = {}) {
  const codes = tickers ?? (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) : []);

  const counts = { updated: 0, review: 0, unchanged: 0, unknown: 0, invalid: 0 };
  const invalid = [];
  const failures = [];
  const items = [];

  for (const code of codes) {
    try {
      const { data } = JSON.parse(fs.readFileSync(path.join(dir, `${code}.json`), "utf8"));
      if (!data?.ticker) throw new Error("field data.ticker tidak ada");
      items.push(data);
    } catch (err) {
      failures.push({ ticker: code, message: "File hasil crawling rusak atau tidak ada", log: err.message }); // COPY: perlu review
    }
  }

  for (const batch of chunk(items, BATCH)) {
    const out = await post(batch);
    for (const k of Object.keys(counts)) counts[k] += out[k] ?? 0;

    for (const r of out.results ?? []) {
      if (r.status !== "invalid") continue;
      invalid.push(r.ticker);
      failures.push({ ticker: r.ticker, message: "Data profil BEI ditolak backend", log: JSON.stringify(r.errors ?? {}) }); // COPY: perlu review
    }
  }

  log(
    `📤 Push ${items.length} emiten: ${counts.updated} updated, ${counts.review} review, ` +
      `${counts.unchanged} unchanged, ${counts.unknown} unknown, ${counts.invalid} invalid` +
      (failures.length - invalid.length ? `, ${failures.length - invalid.length} file rusak` : "")
  );

  return { counts, invalid, failures };
}
