/**
 * 6_company-trading-history-summary.js
 *
 * Usage:
 *   node 6_company-trading-history-summary.js
 *
 * Output:
 *   /data/company/trading-history/[ticker]
 *
 * Sources:
 * https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/[ticker]
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cliProgress from "cli-progress";
import { createFolder } from "../../lib/migrate.js";
import { assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import parser from "../../middleware/idx/6_company-trading-history-summary.parser.js";
import tester from "../../test/idx/6_company-trading-history-summary.test.js";

/* ----------------- Path Utils ----------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COMPANY_IDX_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "company",
  "trading-history"
);
const COMPANY_IDX_MINIFY_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "minify",
  "company",
  "trading-history"
);
const company_json = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "company",
  "company.json"
);

createFolder(COMPANY_IDX_DIR);
createFolder(COMPANY_IDX_MINIFY_DIR);

/* ----------------- Helpers ----------------- */

function ensureFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveOutputPath(code) {
  const outDir = COMPANY_IDX_DIR;

  createFolder(outDir);
  createFolder(COMPANY_IDX_DIR);

  ensureFolder(outDir);
  return path.join(outDir, `${code}.json`);
}

function resolveOutputPathMinify(code) {
  const outDir = COMPANY_IDX_MINIFY_DIR;

  createFolder(outDir);
  ensureFolder(outDir);
  return path.join(outDir, `${code}.json`);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function randomDelay(min = 150, max = 400) {
  return new Promise((r) => setTimeout(r, randomInt(min, max)));
}

async function withRetry(fn, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries || err.hardBlock) throw err;
      await randomDelay(500, 1200);
    }
  }
}

async function detectCloudflare(page) {
  const title = await page.title().catch(() => "");

  if (
    title.includes("Just a moment") ||
    title.includes("Attention Required") ||
    title.includes("blocked")
  ) {
    return true;
  }

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");

  return (
    bodyText.includes("Sorry, you have been blocked") ||
    bodyText.includes("Cloudflare Ray ID")
  );
}

/* ----------------- Scraper ----------------- */

let browser;
let context;
let page;

async function createSession(headless = true) {
  browser = await chromium.launch({
    headless,
    slowMo: randomInt(10, 40),
  });

  context = await browser.newContext({
    userAgent: chromeUA(browser),
    viewport: {
      width: 1280 + randomInt(0, 80),
      height: 720 + randomInt(0, 80),
    },
  });

  page = await context.newPage();
}

async function destroySession() {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}

async function scrapeCorporateAction(code, page) {
  return withRetry(async () => {
    try {
      await page.goto(
        `https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/${code}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }
      );

      await page.waitForLoadState("domcontentloaded");
      await assertNotHardBlocked(page);

      if (await detectCloudflare(page)) {
        throw new Error("Blocked by Cloudflare");
      }

      // pastikan tabel muncul
      try {
        await page.waitForSelector(".tab-nav", {
          timeout: 5000,
        });
      } catch (err) {
        if (await detectCloudflare(page)) {
          throw new Error("Blocked by Cloudflare");
        }

        throw err;
      }

      await page
        .locator(".tab-nav button", {
          hasText: "Info Perdagangan",
        })
        .click();

      await page.waitForTimeout(200);

      // pastikan tabel muncul
      try {
        await page.waitForSelector("table thead tr th span", {
          timeout: 5000,
        });

        await page.waitForFunction(() => {
          return [...document.querySelectorAll("table thead tr th span")].some(
            (el) =>
              el.textContent?.trim() === "Harga Pembukaan" &&
              !el.classList.contains("sr-only")
          );
        });
      } catch (err) {
        if (await detectCloudflare(page)) {
          throw new Error("Blocked by Cloudflare");
        }

        throw err;
      }

      await page.locator(".footer__row-count select").click();

      await page.selectOption('select[name="perPageSelect"]', "-1");

      await page.waitForTimeout(100);

      // Profile perusahaan
      const rows = await page.$$eval(
        ".vgt-responsive table tbody tr",
        (trs) => {
          const text = (el) => el?.innerText?.trim() ?? "";

          return trs.map((tr) => {
            const td = tr.querySelectorAll("td");

            return {
              no: text(td[0]),
              tanggal: text(td[1]),
              harga_pembukaan: text(td[2]),
              tertinggi: text(td[3]),
              terendah: text(td[4]),
              penutupan: text(td[5]),
              volume: text(td[6]),
              nilai: text(td[7]),
              frekuensi: text(td[8]),
            };
          });
        }
      );

      const manipulated = rows;

      const parse = await parser(manipulated);

      const output = {
        total: manipulated?.length,
        data: manipulated,
        scraped_at: new Date().toISOString(),
      };

      const output_min = {
        total: parse?.length,
        data: parse,
        scraped_at: new Date().toISOString(),
      };

      const outPath = resolveOutputPath(code);
      const outPathMin = resolveOutputPathMinify(code);

      if (!tester({ main: output, minify: output_min }, code)) {
        throw new Error("Blocked by Cloudflare");
      }

      fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
      fs.writeFileSync(
        outPathMin,
        JSON.stringify(
          {
            total: parse?.length,
            data: parse,
            scraped_at: new Date().toISOString(),
          },
          null,
          2
        )
      );

      return output;
    } catch (err) {
      console.error("❌ Scrape failed:", err?.message || err);
      throw err;
    }
  });
}

/* ----------------- Entrypoint ----------------- */

export default async function main(options) {
  console.log("🚀 Start scraping IDX Company Trading History...");

  const start = Date.now();

  const company = JSON.parse(fs.readFileSync(company_json, "utf8"));

  const stock_code_list = company?.data?.map((item) => item.kode);

  createFolder(COMPANY_IDX_DIR);

  const company_list_idx = fs
    .readdirSync(COMPANY_IDX_DIR)
    .filter((f) => f.endsWith(".json"));

  const banned = ["MFIN"];

  // options.tickers (retry dari sync) dan options.force mengabaikan cache file
  const toScrape =
    options?.tickers ??
    stock_code_list.filter(
      (code) =>
        code.length === 4 &&
        !banned.includes(code) &&
        (options?.force || !company_list_idx.includes(`${code}.json`))
    );

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

  const failures = [];
  let ok = 0;
  let blocked = false;

  await createSession();

  for (const code of toScrape) {
    progressBar.update(progressBar.value, { code });

    try {
      await scrapeCorporateAction(code, page);
      ok++;
    } catch (err) {
      try {
        if (err.hardBlock || !/Cloudflare|blocked/.test(err.message)) throw err;

        console.log("♻️ Recreating browser session...");
        await destroySession();
        await createSession(false); // 3x diblokir dalam headless → lanjut dengan browser terlihat

        // retry sekali pakai browser baru
        await scrapeCorporateAction(code, page);
        ok++;
      } catch (err2) {
        if (err2.hardBlock) {
          // Diblokir WAF: emiten berikutnya pasti ikut diblokir, jadi berhenti di sini.
          const left = toScrape.length - ok - failures.length;
          console.log(`⛔ ${err2.message}`);
          failures.push({ message: `${err2.message} Berhenti di ${code}, ${left} emiten belum diproses.` });
          blocked = true;
          break;
        }

        console.log(`❌ Failed ${code}: ${err2.message}`);
        failures.push({ ticker: code, message: err2.message });
      }
    }

    progressBar.increment();
    await randomDelay(1500, 3000); // jeda antar emiten supaya tidak memicu blokir
  }

  progressBar.stop();
  await destroySession();

  if (!options?.disableConsole)
    console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);

  return { ok, total: toScrape.length, failures, blocked };
}
