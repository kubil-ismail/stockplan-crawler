/**
 * company-list-summary.js
 *
 * Usage:
 *   node company-list-summary.js
 *
 * Output:
 *   /data/company/company.json
 *
 * Sources:
 * https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createFolder } from "../../lib/migrate.js";
import { withHeadfulFallback, assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import parser from "../../middleware/idx/1_company-list-summary.parser.js";
import tester from "../../test/idx/1_company-list-summary.test.js";

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
  return path.join(outDir, `company.json`);
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
  return path.join(outDir, `company.json`);
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

      await page.goto(
        `https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat`,
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
            kode: text(td[0]),
            nama: text(td[1]),
            tanggal: text(td[2]),
          };
        });
      });

      const output = {
        total: rows.length,
        data: rows,
        scraped_at: new Date().toISOString(),
      };

      const parse = parser(rows);

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
  console.log("🚀 Start scraping IDX List Summary ...");

  const start = Date.now();

  const companyJsonPath = path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "idx",
    "company",
    "company.json"
  );

  let shouldScrape = true;

  try {
    // cek apakah file ada
    if (fs.existsSync(companyJsonPath)) {
      const company = JSON.parse(fs.readFileSync(companyJsonPath, "utf8"));

      // kalau ada data -> skip scrape
      if (company?.data?.length > 0) {
        shouldScrape = false;

        if (!options?.disableConsole) {
          console.log(
            `✅ company.json exists (${company.data.length} data), skip scraping`
          );
        }
      }
    } else {
      console.log("📁 company.json not found, start scraping...");
    }
  } catch (err) {
    console.error("❌ Failed checking company.json:", err);
  }

  if (shouldScrape) {
    await withHeadfulFallback(scrapeCorporateAction, options);
  }

  if (!options?.disableConsole) {
    console.log(`🎯 Done in ${((Date.now() - start) / 1000).toFixed(2)}s`);
  }
}
