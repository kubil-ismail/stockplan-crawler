/**
 * company-summary.js
 *
 * Usage:
 *   node company-summary.js
 *
 * Output:
 *   /data/company/detail/idx/[TICKER].json
 *
 * Sources:
 * https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/${ticker}
 */

import { chromium } from "../../lib/browser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cliProgress from "cli-progress";
import { createFolder } from "../../lib/migrate.js";
import { assertNotHardBlocked } from "../../lib/helper.js";

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
  "financial",
);
const COMPANY_IDX_MIN_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "minify",
  "company",
  "financial",
);
const company_json = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "company",
  "company.json",
);

createFolder(COMPANY_IDX_DIR);

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
  const outDir = COMPANY_IDX_MIN_DIR;

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

async function createSession() {

  browser = await chromium.launch({
    headless: false,
  });

  context = await browser.newContext({
    viewport: {
      width: 1280 + Math.floor(Math.random() * 100), // Randomize a bit
      height: 720 + Math.floor(Math.random() * 100),
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });

  page = await context.newPage();

  page.setDefaultNavigationTimeout(30000);
}




async function downloadAuditedReports(page, code, year) {
  try {
    // Pilih periode Audit
    const periodDropdown = page.locator(".latest-tw");
    const periodToggle = periodDropdown.locator(".vs__dropdown-toggle");
    const selectedPeriod = periodDropdown.locator(".vs__selected");

    const currentPeriod = (await selectedPeriod.textContent())?.trim();

    if (currentPeriod !== "Audit") {
      await periodToggle.click();

      const periodOptions = page.locator("#vs2__listbox [role='option']");

      await periodOptions.first().waitFor({
        state: "visible",
        timeout: 5000,
      });

      await periodOptions.getByText("Audit", { exact: true }).click();

      await page.waitForFunction(
        () =>
          document
            .querySelector(".latest-tw .vs__selected")
            ?.textContent.trim() === "Audit",
        null,
        { timeout: 5000 },
      );
    }

    // Tunggu data laporan diperbarui
    await page.waitForTimeout(1000);

    // Cari container laporan
    const reportHeading = page
      .locator("h4")
      .filter({ hasText: "Unduh Laporan Keuangan Lainnya" })
      .first();

    if ((await reportHeading.count()) === 0) {
      console.log(`[${code}] Skip ${year}: heading tidak ditemukan`);
      return [];
    }

    const reportContainer = reportHeading.locator(
      "xpath=following-sibling::div[1]",
    );

    if ((await reportContainer.count()) === 0) {
      console.log(`[${code}] Skip ${year}: container tidak ditemukan`);
      return [];
    }

    // Ambil semua card
    const cards = reportContainer.locator(".bzg_c .box");
    const cardCount = await cards.count();

    if (cardCount === 0) {
      console.log(`[${code}] Skip ${year}: data laporan kosong`);
      return [];
    }

    const downloaded = [];

    // Proses semua card laporan
    for (let c = 0; c < cardCount; c++) {
      const card = cards.nth(c);

      try {
        const cardTitle = (await card.locator(".box-title").innerText()).trim();

        const yearMatch = cardTitle.match(/Tahun\s*(\d{4})/i);
        const periodMatch = cardTitle.match(/Periode\s*(.+)/i);

        const cardYear = yearMatch?.[1] ?? String(year);
        const cardPeriod = periodMatch?.[1]?.trim() ?? "Lainnya";

        const safePeriod = cardPeriod.replace(/[/\\?%*:|"<>]/g, "_");

        // Folder berdasarkan tahun dan periode pada card
        const outputDir = path.join(
          COMPANY_IDX_DIR,
          code,
          cardYear,
          safePeriod,
        );

        ensureFolder(outputDir);

        const links = card.locator("table a[download]");
        const count = await links.count();

        if (count === 0) {
          console.log(`[${code}] Skip card tanpa dokumen: ${cardTitle}`);
          continue;
        }

        // Proses semua dokumen dalam card
        for (let i = 0; i < count; i++) {
          const link = links.nth(i);

          try {
            const row = link.locator("xpath=ancestor::tr[1]");
            const fileName = (
              await row.locator("td").first().innerText()
            ).trim();

            const safeName = path
              .basename(fileName)
              .replace(/[/\\?%*:|"<>]/g, "_");

            const outputPath = path.join(outputDir, safeName);

            // Lewati file yang sudah tersedia
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              console.log(`[${code}] Skip existing: ${outputPath}`);
              downloaded.push(outputPath);
              continue;
            }

            console.log(`[${code}] Downloading: ${outputPath}`);

            // Tunggu event download
            const downloadPromise = page.waitForEvent("download", {
              timeout: 30000,
            });

            await link.click();

            let download;

            try {
              download = await downloadPromise;
            } catch (err) {
              if (err.name === "TimeoutError") {
                console.warn(
                  `[${code}] Skip tahun ${year}: download timeout pada ${fileName}`,
                );

                // Hentikan seluruh proses tahun ini
                return [];
              }

              throw err;
            }

            await download.saveAs(outputPath);

            if (
              !fs.existsSync(outputPath) ||
              fs.statSync(outputPath).size === 0
            ) {
              console.warn(
                `[${code}] Skip tahun ${year}: file kosong atau tidak ditemukan`,
              );

              // Hentikan seluruh proses tahun ini
              return [];
            }

            downloaded.push(outputPath);

            console.log(`[${code}] Downloaded: ${outputPath}`);
          } catch (err) {
            // Timeout atau error lain pada dokumen:
            // skip tahun ini jika timeout, skip file jika error biasa.
            if (err.name === "TimeoutError") {
              console.warn(`[${code}] Skip tahun ${year}: ${err.message}`);
              return [];
            }

            console.warn(
              `[${code}] Skip file pada tahun ${year}: ${err.message}`,
            );
            continue;
          }
        }
      } catch (err) {
        if (err.name === "TimeoutError") {
          console.warn(`[${code}] Skip tahun ${year}: ${err.message}`);
          return [];
        }

        console.warn(
          `[${code}] Skip card ${c + 1} pada tahun ${year}: ${err.message}`,
        );
        continue;
      }
    }

    console.log(`[${code}] Total dokumen tahun ${year}: ${downloaded.length}`);

    return downloaded;
  } catch (err) {
    // Error pada proses awal juga tidak menghentikan crawler
    console.warn(`[${code}] Skip tahun ${year}: ${err.message}`);

    return [];
  }
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
        },
      );

      await page.waitForLoadState("domcontentloaded");
      await assertNotHardBlocked(page);

      if (await detectCloudflare(page)) {
        throw new Error("Blocked by Cloudflare");
      }

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
          hasText: "Laporan Keuangan",
        })
        .click();

      await page.waitForTimeout(200);

      const yearDropdown = page.locator(".input-period");
      const toggle = yearDropdown.locator(".vs__dropdown-toggle");

      // Buka dropdown tahun
      await toggle.click();

      // Cari opsi yang benar-benar dirender oleh vue-select.
      const options = page.locator("#vs3__listbox [role='option']");

      await options.first().waitFor({
        state: "visible",
        timeout: 5000,
      });

      const years = (await options.allTextContents())
        .map((text) => text.trim())
        .filter((text) => /^\d{4}$/.test(text))
        .sort((a, b) => Number(a) - Number(b));

      // Proses setiap opsi tahun
      for (const year of years) {
        // Dropdown mungkin tertutup setelah memilih opsi sebelumnya.
        if (
          (await yearDropdown
            .locator(".vs__dropdown-toggle")
            .getAttribute("aria-expanded")) !== "true"
        ) {
          await toggle.click();
        }

        const option = page
          .locator("#vs3__listbox [role='option']")
          .getByText(year, { exact: true });

        await option.click();

        // Pastikan nilai yang tampil benar-benar berubah.
        await page.waitForFunction(
          (expectedYear) => {
            const el = document.querySelector(".input-period .vs__selected");
            return el?.textContent.trim() === expectedYear;
          },
          year,
          { timeout: 5000 },
        );

        // Tunggu aplikasi memperbarui data tahun terpilih.
        await page.waitForTimeout(1000);

        const reportContainer = page.locator(".container .bzg.mb-12").filter({
          has: page.locator(".box"),
        });

        if ((await reportContainer.count()) === 0) {
          continue;
        }

        const reportCards = reportContainer.locator(".bzg_c .box");

        if ((await reportCards.count()) === 0) {
          continue;
        }

        // await downloadAuditedReports(page, code, year);
      }

      return {};
    } catch (err) {
      throw err;
    }
  });
}

/* ----------------- Entrypoint ----------------- */

export default async function main(options) {
  console.log("🚀 Start scraping IDX Company Detail...");

  const start = Date.now();

  const company = JSON.parse(fs.readFileSync(company_json, "utf8"));

  const stock_code_list = company?.data?.map((item) => item.kode);

  const company_list_idx = fs
    .readdirSync(COMPANY_IDX_DIR)
    .filter((f) => f.endsWith(".json"));

  const toScrape = stock_code_list.filter(
    (code) => !company_list_idx.includes(`${code}.json`),
  );

  const banned = ["MFIN"];

  // progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: "🚀 Scraping [{bar}] {percentage}% | {value}/{total} | {code}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );

  progressBar.start(toScrape.length, 0, {
    code: "-",
    source: "-",
    status: "waiting",
  });

  await createSession();

  for (const code of toScrape) {
    if (code.length === 4) {
      const needIDX =
        !company_list_idx.includes(`${code}.json`) && !banned.includes(code);

      if (needIDX) {
        progressBar.update(progressBar.value, {
          code: code,
        });

        try {
          await scrapeCorporateAction(code, page, options);
        } catch (err) {
          console.log(`❌ Failed ${code}: ${err.message}`);

          if (
            err.message.includes("Cloudflare") ||
            err.message.includes("blocked")
          ) {
            console.log("♻️ Recreating browser session...");

            await destroySession();
            await createSession();

            // retry sekali pakai browser baru
            await scrapeCorporateAction(code, page, options);
          }
        }
      }

      progressBar.increment();
    }
  }

  progressBar.stop();
  destroySession();

  if (!options?.disableConsole) {
    console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);
  }
}
