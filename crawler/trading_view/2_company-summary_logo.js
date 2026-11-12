/**
 * company-summary_logo.js
 *
 * Usage:
 *   node company-summary_logo.js
 *
 * Output:
 *   /data/company/logo/[TICKER].json
 *
 * Sources:
 * https://id.tradingview.com/symbols/IDX-${code}
 */

import { chromium } from "../../lib/browser.js";
import { faker } from "@faker-js/faker";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import download from "image-downloader";
import cliProgress from "cli-progress";
import { createFolder } from "../../lib/migrate.js";

/* ----------------- Path Utils ----------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const __dirname = path.dirname(new URL(import.meta.url).pathname);
const LOGO_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "trading_view",
  "company",
  "logo"
);
const COMPANY_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "trading_view",
  "company",
  "logo"
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

createFolder(COMPANY_DIR);

/* ----------------- Helpers ----------------- */

function ensureFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
      if (i === retries) throw err;
      await randomDelay(500, 1200);
    }
  }
}

function downloadImage(url, filepath) {
  try {
    return download.image({
      url,
      dest: filepath,
    });
  } catch (err) {
    return err;
  }
}

/* ----------------- Scraper ----------------- */

async function scrapeCorporateAction(code, page) {
  try {
    await withRetry(() =>
      page.goto(`https://id.tradingview.com/symbols/IDX-${code}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
    );

    // await randomDelay();
    // await randomMouseMove(page);

    const existingFile = fs
      .readdirSync(LOGO_DIR)
      .find((f) => f.startsWith(`${code}.`));

    if (existingFile) {
      return {
        data: {
          logo: path.join(LOGO_DIR, existingFile),
        },
        scraped_at: new Date().toISOString(),
        skipped: true,
      };
    }

    const logo = await page.evaluate(() => {
      const img = document.querySelector(".js-symbol-page-header-root img");
      if (!img) return null;

      const src = img.getAttribute("src");
      if (!src) return null;

      // bikin absolute URL
      return src;
    });

    let logoPath = null;

    if (logo) {
      ensureFolder(LOGO_DIR);

      const ext = path.extname(logo).split("?")[0] || ".png";
      logoPath = path.join(LOGO_DIR, `${code}${ext}`);

      downloadImage(logo, logoPath);
    }
  } catch (err) {
    console.error("❌ Scrape failed:", err?.message || err);
    try {
      // if (browser) await browser.close();
      return null;
    } catch (_) {}
    return null;
  }
}

/* ----------------- Entrypoint ----------------- */

export default function main() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🚀 Start scraping IDX LOGO...");

      const start = Date.now();

      const company = JSON.parse(fs.readFileSync(company_json, "utf8"));

      const stock_code_list = company?.data?.map((item) => item.kode);

      const company_list = fs
        .readdirSync(COMPANY_DIR)
        .filter((f) => f.endsWith(".svg"));

      const toScrape = stock_code_list.filter(
        (code) => !company_list.includes(`${code}.svg`)
      );

      const banned = fs.readdirSync(LOGO_DIR).map((item) => item.split(".")[0]);

      const filteredList = toScrape.filter(
        (code) => code.length === 4 && !banned.includes(code)
      );

      const browser = await chromium.launch({
        headless: false,
        slowMo: randomInt(10, 40),
      });

      const context = await browser.newContext({
        userAgent: faker.internet.userAgent(),
        viewport: {
          width: 1280 + randomInt(0, 80),
          height: 720 + randomInt(0, 80),
        },
      });

      const page = await context.newPage();

      const progressBar = new cliProgress.SingleBar(
        {
          format: "🖼️ LOGO [{bar}] {percentage}% | {value}/{total} | {code}",
          barCompleteChar: "█",
          barIncompleteChar: "░",
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic
      );

      progressBar.start(filteredList.length, 0, {
        code: "-",
      });

      for (const code of toScrape) {
        if (code.length === 4 && !banned.includes(code)) {
          progressBar.update(progressBar.value, {
            code,
          });

          try {
            await scrapeCorporateAction(code, page);
          } catch (error) {
            console.log(`\n❌ Failed ${code}`);
          }

          progressBar.increment();
        }
      }

      progressBar.stop();

      await browser.close();

      console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);

      resolve(true);
    } catch (err) {
      reject(err);
    }
  });
}
