/**
 * company-corporate-summary.js
 *
 * Usage:
 *   node 4_company-corporate-summary.js
 *
 * Output:
 *   /data/information/corporate_actions.json
 *
 * Sources:
 * https://www.idx.co.id/id/perusahaan-tercatat/aksi-korporasi
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createFolder } from "../../lib/migrate.js";
import { withHeadfulFallback, assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import parser from "../../middleware/idx/4_company-corporate-summary.parser.js";
import tester from "../../test/idx/4_company-corporate-summary.test.js";

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
  const outDir = path.join(__dirname, "..", "..", "dist", "idx", "information");

  createFolder(outDir);
  ensureFolder(outDir);
  return path.join(outDir, `corporate_actions.json`);
}

function resolveOutputPathMinify() {
  const outDir = path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "idx",
    "minify",
    "information"
  );

  createFolder(outDir);
  ensureFolder(outDir);
  return path.join(outDir, `corporate_actions.json`);
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

      await page.goto(
        `https://www.idx.co.id/id/perusahaan-tercatat/aksi-korporasi`,
        {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }
      );

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

      await page.selectOption('select[name="perPageSelect"]', "-1");

      await page.waitForTimeout(500);

      // Profile perusahaan
      const rows = await page.$$eval(".vgt-boxed table tbody tr", (trs) => {
        const text = (el) => el?.innerText?.trim() ?? "";

        return trs.map((tr) => {
          const td = tr.querySelectorAll("td");

          return {
            Tanggal: text(td[0]),
            Kode_Emiten: text(td[1]),
            Tipe_Aksi_Korporasi: text(td[2]),
            Jumlah_Aksi_Korporasi: text(td[3]),
            Jumlah_Total: text(td[4]),
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

export default function main(options) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🚀 Start scraping IDX Corporate Summary...");

      const corporate_actions = path.join(
        __dirname,
        "..",
        "..",
        "dist",
        "idx",
        "information",
        "corporate_actions.json"
      );

      let shouldScrape = true;

      const start = Date.now();

      // cek apakah file ada
      if (fs.existsSync(corporate_actions)) {
        const file = JSON.parse(fs.readFileSync(corporate_actions, "utf8"));

        // kalau ada data -> skip scrape
        if (file?.data?.length > 0) {
          shouldScrape = false;

          if (!options?.disableConsole)
            console.log(
              `✅ corporate_actions.json exists (${file.data.length} data), skip scraping`
            );
        }
      } else {
        if (!options?.disableConsole)
          console.log("📁 corporate_actions.json not found, start scraping...");
      }

      if (shouldScrape) await withHeadfulFallback(scrapeCorporateAction, options);
      if (!options?.disableConsole)
        console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);

      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}
