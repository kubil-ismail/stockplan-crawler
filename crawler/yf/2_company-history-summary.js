/**
 * company-history-summary.js
 *
 * Usage:
 *   node company-history-summary.js
 *
 * Output:
 *   /data/company/detail/yf/[TICKER].json
 *
 * Sources:
 * https://finance.yahoo.com/quote/${ticker}.JK
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cliProgress from "cli-progress";
import { getFinancialHistory } from "../../lib/yahoo.js";
import { createFolder } from "../../lib/migrate.js";

/* ----------------- Path Utils ----------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY_YF_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "yf",
  "company",
  "history"
);

createFolder(COMPANY_YF_DIR);
const company_json = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "company",
  "company.json"
);

function ensureFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveOutputYFPath(code) {
  const outDir = COMPANY_YF_DIR;
  ensureFolder(outDir);
  return path.join(outDir, `${code}.JK.json`);
}

/* ----------------- Helpers ----------------- */

/* ----------------- Entrypoint ----------------- */

export default async function main() {
  console.log("🚀 Start scraping IDX history Company Detail...");
  const start = Date.now();

  const company = JSON.parse(fs.readFileSync(company_json, "utf8"));

  const stock_code_list = company?.data?.map((item) => item.kode);

  const company_list_idx = fs
    .readdirSync(COMPANY_YF_DIR)
    .filter((f) => f.endsWith(".json"));

  const toScrape = stock_code_list.filter(
    (code) => !company_list_idx.includes(`${code}.JK.json`)
  );

  const banned = [];

  // progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: "🚀 Scraping [{bar}] {percentage}% | {value}/{total} | {code}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(toScrape.length, 0, {
    code: "-",
    source: "-",
    status: "waiting",
  });

  for (const code of toScrape) {
    if (code.length === 4) {
      try {
        progressBar.update(progressBar.value, {
          code,
        });

        const request = await getFinancialHistory(code);

        const outPath = resolveOutputYFPath(code);

        if (request.data?.length)
          fs.writeFileSync(outPath, JSON.stringify(request, null, 2));
      } catch (err) {
        console.log(`❌ Failed ${code}`);
      }

      progressBar.increment();
    }
  }

  progressBar.stop();
  console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);
}
