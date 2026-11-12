/**
 * company-screener-summary.js
 *
 * Usage:
 *   node 3_company-screener-summary.js
 *
 * Output:
 *   /data/company/stock_screener.json
 *
 * Sources:
 * https://www.idx.co.id/id/investhub/stock-screener
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createFolder } from "../../lib/migrate.js";
import { withHeadfulFallback, assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import parser from "../../middleware/idx/3_company-screener-summary.parser.js";
import tester from "../../test/idx/3_company-screener-summary.test.js";

/* ----------------- Path Utils ----------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ----------------- Helpers ----------------- */

function ensureFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveOutputPath() {
  const outDir = path.join(__dirname, "..", "..", "dist", "idx", "company");
  createFolder(outDir);
  ensureFolder(outDir);
  return path.join(outDir, `stock_screener.json`);
}

function resolveOutputPathMinify() {
  const outDir = path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "idx",
    "minify",
    "company"
  );

  createFolder(outDir);
  ensureFolder(outDir);
  return path.join(outDir, `stock_screener.json`);
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

async function scrapeCorporateAction(options) {
  return withRetry(async () => {
    let browser;
    try {
      browser = await chromium.launch({
        headless: options?.headless ?? true,
        slowMo: randomInt(10, 40),
      });

      const context = await browser.newContext({
        userAgent: chromeUA(browser),
        viewport: {
          width: 1280 + randomInt(0, 80),
          height: 720 + randomInt(0, 80),
        },
      });

      const page = await context.newPage();

      await page.goto(`https://www.idx.co.id/id/investhub/stock-screener`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page.waitForLoadState("domcontentloaded");
      await assertNotHardBlocked(page);

      // CHECK IF BLOCKED
      const blocked = await page
        .locator('h1[data-translate="block_headline"]')
        .isVisible()
        .catch(() => false);

      if (blocked) {
        throw new Error("Blocked by Cloudflare");
      }

      const html = await page.content();
      if (
        html.includes("Sorry, you have been blocked") ||
        html.includes("Cloudflare Ray ID") ||
        html.includes("cf-error-details")
      ) {
        throw new Error("Blocked by Cloudflare");
      }

      // pastikan tabel muncul
      try {
        await page.waitForSelector("table tbody tr", {
          timeout: 5000,
        });
      } catch (err) {
        if (await detectCloudflare(page)) {
          throw new Error("Blocked by Cloudflare");
        }

        throw err;
      }

      try {
        await page.waitForSelector("button.btn-filter-input.btn-col-filter", {
          timeout: 5000,
        });
        await page.click("button.btn-filter-input.btn-col-filter");
      } catch (err) {
        console.warn("⚠️ Tombol KOL0M tidak ditemukan — lanjut tanpa filter.");
      }

      // === Filter kolom hanya untuk data yang dibutuhkan ===

      await page.waitForSelector(".column-filter", { timeout: 5000 });

      await page.waitForTimeout(500);

      // List kolom yang diperlukan
      const allowed = ["Pilih Semua"];

      const checkboxes = await page.$$(".column-filter input[type='checkbox']");
      for (const cb of checkboxes) {
        const label = await cb.evaluate((el) =>
          el.parentElement.innerText.trim()
        );

        const shouldBeChecked = allowed.includes(label);

        if (shouldBeChecked) {
          await cb.click();
          const submit = page.locator(
            '.column-filter button:has-text("Terapkan")'
          );
          await submit.first().click();
        }
      }

      await page.click("button.btn-filter-input.btn-col-filter");

      await page.selectOption('select[name="perPageSelect"]', "-1");

      await page.waitForTimeout(1000);

      // Profile perusahaan
      const rows = await page.$$eval(".vgt-boxed table tbody tr", (trs) => {
        const text = (el) => el?.innerText?.trim() ?? "";

        return trs.map((tr) => {
          const td = [...tr.querySelectorAll("td")];

          // Debug kalau jumlah kolom berubah
          if (td.length !== 22) {
            console.warn("Unexpected column count:", td.length);
            console.log(td.map((x) => text(x)));
          }

          const parseChange = (td) => {
            if (!td) return null;

            const direction =
              td && td.querySelector(".bzi-caret-down")
                ? "-"
                : td && td.querySelector(".bzi-caret-up")
                ? "+"
                : "=";

            // ambil angka (bersihin dari simbol % dll)
            const value = text(td).replace("= ", "");

            return {
              value: value ? value : null,
              direction,
            };
          };

          return {
            Nama_Perusahaan: text(td[0]),
            Kode_Saham: text(td[1]),
            Sektor: text(td[3]),
            Subsektor: text(td[4]),
            Idustri: text(td[5]),
            Subindustri: text(td[6]),
            Index: text(td[7]),

            Per: text(td[8]),
            Pbv: text(td[9]),
            Roe: text(td[10]),
            Roa: text(td[11]),
            Der: text(td[12]),
            Mkt_Cap: text(td[13]),
            Total_Rev: text(td[14]),

            _4_wk_chg: parseChange(td[15]),
            _13_wk_chg: parseChange(td[16]),
            _26_wk_chg: parseChange(td[17]),
            _52_wk_chg: parseChange(td[18]),

            npm: text(td[19]),
            mtd: parseChange(td[20]),
            ytd: parseChange(td[21]),
          };
        });
      });

      const output = {
        total: rows.length,
        data: rows,
        scraped_at: new Date().toISOString(),
      };

      const parse = await parser(rows);

      const outPath = resolveOutputPath();
      const outPathMin = resolveOutputPathMinify();

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

      tester({ main: outPath, minify: outPathMin });

      if (!options?.disableConsole) console.log(`✅ Saved to: ${outPath}`);

      await context.close();
      await browser.close();

      return output;
    } catch (err) {
      console.error("❌ Scrape failed:", err?.message || err);
      throw err;
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  });
}

/* ----------------- Entrypoint ----------------- */
export default async function main(options) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🚀 Start scraping IDX Technical Summary...");

      const technical_summary = path.join(
        __dirname,
        "..",
        "..",
        "dist",
        "idx",
        "company",
        "stock_screener.json"
      );

      let shouldScrape = true;

      const start = Date.now();
      // cek apakah file ada
      if (fs.existsSync(technical_summary)) {
        const file = JSON.parse(fs.readFileSync(technical_summary, "utf8"));

        // kalau ada data -> skip scrape
        if (file?.data?.length > 0 && !options?.force) {
          shouldScrape = false;
          if (!options?.disableConsole)
            console.log(
              `✅ stock_screener.json exists (${file.data.length} data), skip scraping`
            );
        }
      } else {
        if (!options?.disableConsole)
          console.log("📁 stock_screener.json not found, start scraping...");
      }

      const output = shouldScrape ? await withHeadfulFallback(scrapeCorporateAction, options) : null;

      if (!options?.disableConsole)
        console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);

      resolve(output);
    } catch (err) {
      reject(err);
    }
  });
}
