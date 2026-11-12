/**
 * company-calendar-summary.js
 *
 * Usage:
 *   node 5_company-calendar-summary.js
 *
 * Output:
 *   /data/calendar/calendar.json
 *
 * Sources:
 * https://www.idx.co.id/id/perusahaan-tercatat/kalender-perusahaan-tercatat
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment";
import { createFolder } from "../../lib/migrate.js";
import { assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import cliProgress from "cli-progress";
import parser from "../../middleware/idx/5_company-calendar-summary.parser.js";
import tester from "../../test/idx/5_company-calendar-summary.test.js";

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
  return path.join(outDir, `calendar.json`);
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
  return path.join(outDir, `calendar.json`);
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

async function scrapeCorporateAction(page, dateObj) {
  try {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");

    // set datepicker input (robust)
    try {
      await page.waitForSelector('input[name="date"]', { timeout: 10000 });
    } catch (err) {
      console.warn("⚠️ Date input tidak ditemukan. Skip date.");
      return null;
    }

    // set date value and trigger events
    await page.evaluate(
      ({ yyyy, mm, dd }) => {
        const input = document.querySelector('input[name="date"]');
        if (!input) return;
        // set in format yyyy-mm-dd
        input.value = `${yyyy}-${mm}-${dd}`;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { yyyy, mm, dd }
    );

    await randomDelay(200, 300);

    const emptyMessage = page.locator("h5.text-grey.mt-12", {
      hasText: "Data daftar kalender perusahaan tidak ditemukan",
    });

    if (await emptyMessage.isVisible().catch(() => false)) {
      console.log(`⚪ Tidak ada data: ${yyyy}-${mm}-${dd}`);

      return [];
    }

    // pastikan tabel muncul
    await page.waitForSelector(".grid-zebra-body .bzg", {
      timeout: 5000,
    });

    // ✅ ambil tanggal pertama (.f--semi)
    const date = await page
      .locator(".flex.f-space-between span.f--semi")
      .first()
      .textContent();

    // Profile perusahaan
    const rows = await page.$$eval(".grid-zebra-body .bzg", (items) => {
      const text = (el) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

      return items.map((row) => {
        const cols = row.querySelectorAll(".bzg_c");

        return {
          kode: text(cols[0]),
          perihal: text(cols[1]),
          lokasi: text(cols[2]),
        };
      });
    });

    const output = rows?.map((item) => ({ ...item, tanggal: date }));

    return output;
  } catch (err) {
    console.error("❌ Scrape failed:", err?.message || err);
    throw err;
  }
}

/* ----------------- Entrypoint ----------------- */

export default async function main(options) {
  console.log("🚀 Start scraping IDX Calendar Summary...");

  const start = Date.now();

  const today = moment();
  const formatted = today.format("YYYY-MM-DD");

  // Bulan berjalan, hanya hari kerja Senin-Jumat
  const dates = [];

  const startDate = today.clone().startOf("month");
  const endDate = today.clone().endOf("month");

  let current = startDate.clone();

  while (current.isSameOrBefore(endDate, "day")) {
    if (current.isoWeekday() <= 5) {
      dates.push(current.clone());
    }

    current.add(1, "day");
  }

  if (!options?.disableConsole)
    console.log(
      `📅 Scraping tanggal: ${dates?.[0].format("YYYY-MM-DD")} sampai ${dates?.[
        dates?.length - 1
      ].format("YYYY-MM-DD")}`
    );

  // progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: "🚀 Scraping [{bar}] {percentage}% | {value}/{total} | {date}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(dates.length, 0, {
    code: "-",
    source: "-",
    status: "waiting",
  });

  const results = await withRetry(async () => {
    let browser;
    let context;

    try {
      browser = await chromium.launch({
        headless: false,
        slowMo: randomInt(10, 40),
      });

      context = await browser.newContext({
        userAgent: chromeUA(browser),
        viewport: {
          width: 1280 + randomInt(0, 80),
          height: 720 + randomInt(0, 80),
        },
      });

      const page = await context.newPage();

      await page.goto(
        "https://www.idx.co.id/id/perusahaan-tercatat/kalender-perusahaan-tercatat",
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

      const data = [];

      for (const item of dates) {
        progressBar.update(progressBar.value, {
          date: item.toDate(),
        });

        const result = await scrapeCorporateAction(page, item.toDate());

        if (result?.length) {
          data.push(...result);

          progressBar.increment();
        }

        await randomDelay(300, 700);
      }

      return data;

      // return await scrapeCorporateAction(page, today.toDate());
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  }, 5);

  progressBar.stop();

  const parse = await parser(results);

  const outPath = resolveOutputPath();
  const outPathMin = resolveOutputPathMinify();

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        total: results?.length || 0,
        data: results || [],
        scraped_at: new Date(),
      },
      null,
      2
    )
  );

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
  if (!options?.disableConsole)
    console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);

  return {
    success: true,
    total: results?.length || 0,
    output: outPath,
  };
}
