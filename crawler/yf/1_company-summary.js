/**
 * company-summary.js
 *
 * Usage:
 *   node 1_company-summary.js
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
import { getAssetProfile } from "../../lib/yahoo.js";
import { createFolder } from "../../lib/migrate.js";

/* ----------------- Path Utils ----------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COMPANY_YF_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "yf",
  "company",
  "detail"
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

/* ----------------- Helpers ----------------- */

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

/* ----------------- Entrypoint ----------------- */

export default async function main() {
  console.log("🚀 Start scraping IDX Company Detail...");
  const start = Date.now();

  const company = JSON.parse(fs.readFileSync(company_json, "utf8"));

  const stock_code_list = company?.data?.map((item) => item.kode);

  const company_list_yf = fs
    .readdirSync(COMPANY_YF_DIR)
    .filter((f) => f.endsWith(".json"));

  const toScrape = stock_code_list.filter(
    (code) => !company_list_yf.includes(`${code}.JK.json`)
  );

  const banned = ["MFIN.JK", "WBSA.JK"];

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
      progressBar.update(progressBar.value, {
        code,
      });

      try {
        const needYF =
          !company_list_yf.includes(`${code}.JK.json`) &&
          !banned.includes(`${code}.JK`);

        if (needYF) {
          progressBar.update(progressBar.value, {
            code: `${code}-YF`,
          });

          const technical = await getAssetProfile(code);

          if (technical.success && technical?.data?.assetProfile) {
            const outPath = resolveOutputYFPath(code);

            fs.writeFileSync(outPath, JSON.stringify(technical, null, 2));
          } else {
            console.log(`❌ [YF] Failed ${code}`);
          }
        }
      } catch (err) {
        console.log(`❌ Failed ${code}`);
      }

      progressBar.increment();
    }
  }

  progressBar.stop();
  browser.close();

  console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);
}
