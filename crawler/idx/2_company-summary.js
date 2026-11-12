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
import { assertNotHardBlocked, chromeUA } from "../../lib/helper.js";
import parser from "../../middleware/idx/2_company-summary.parser.js";
import tester from "../../test/idx/2_company-summary.test.js";

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
  "detail"
);
const COMPANY_IDX_MIN_DIR = path.join(
  __dirname,
  "..",
  "..",
  "dist",
  "idx",
  "minify",
  "company",
  "detail"
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
        await page.waitForSelector("table tbody tr", {
          timeout: 5000,
        });
      } catch (err) {
        if (await detectCloudflare(page)) {
          throw new Error("Blocked by Cloudflare");
        }

        throw err;
      }

      const logo = await page.evaluate(() => {
        const img = document.querySelector("#emitenLogo");
        if (!img) return null;

        const src = img.getAttribute("src");
        if (!src) return null;

        // bikin absolute URL
        return src;
      });

      // Profile perusahaan
      const rows = await page.$$eval(".bzg_c table tbody tr", (trs) => {
        const text = (el) => el?.innerText?.trim() ?? "";

        const profil_company = [
          "Nama",
          "Kode",
          "Alamat Kantor",
          "Alamat Email",
          "Telepon",
          "Fax",
          "NPWP",
          "Situs",
          "Tanggal Pencatatan",
          "Papan Pencatatan",
          "Bidang Usaha Utama",
          "Sektor",
          "Subsektor",
          "Industri",
          "Subindustri",
          "Biro Administrasi Efek",
        ];

        return trs
          .filter((tr) => {
            const td = tr.querySelectorAll("td");

            if (profil_company.includes(text(td[0]))) {
              return true;
            }

            return false;
          })
          .map((tr) => {
            const td = tr.querySelectorAll("td");

            return {
              [text(td[0])]: text(td[2]),
            };
          })
          .reduce((acc, curr) => {
            return { ...acc, ...curr };
          }, {});
      });

      // Sekretaris Perusahaan
      const sekretariat = await page.evaluate(() => {
        const anchor = document.querySelector("#Secretary");
        if (!anchor) return null;

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return null;

        const table = wrapper.querySelector("table");
        if (!table) return null;

        // contoh ambil data jadi object
        const rows = Array.from(table.querySelectorAll("tr"))
          .map((tr) => {
            const tds = tr.querySelectorAll("td");
            return {
              [tds[0]?.innerText.trim()]: tds[2]?.innerText.trim(),
            };
          })
          .reduce((acc, curr) => {
            return { ...acc, ...curr };
          }, {});

        return rows;
      });

      // Direktur
      const directors = await page.evaluate(() => {
        const anchor = document.querySelector("#Director");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
            posisi: tds[1]?.innerText.trim(),
            terafiliasi: tds[2]?.innerText.trim(),
          };
        });
      });

      // Komisaris
      const commissioner = await page.evaluate(() => {
        const anchor = document.querySelector("#Comissioners");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
            posisi: tds[1]?.innerText.trim(),
            terafiliasi: tds[2]?.innerText.trim(),
          };
        });
      });

      // Komite Audit
      const committee = await page.evaluate(() => {
        const anchor = document.querySelector("#Committee");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
            posisi: tds[1]?.innerText.trim(),
          };
        });
      });

      // Pemegang Saham
      const shareholders = await page.evaluate(() => {
        const anchor = document.querySelector("#Shareholders");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
            tipe: tds[1]?.innerText.trim(),
            jumlah: tds[2]?.innerText.trim(),
            persentase: tds[3]?.innerText.trim(),
          };
        });
      });

      await page.selectOption('select[name="perPageSelect"]', "-1");

      await page.waitForTimeout(100);

      // Anak Perusahaan
      const subsidiary = await page.evaluate(async () => {
        const anchor = document.querySelector("#Subsidiary");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
            jenis: tds[1]?.innerText.trim(),
            "aset total": tds[2]?.innerText.trim(),
            persentase: tds[3]?.innerText.trim(),
          };
        });
      });

      // Akuntan Publik
      const publicAccountant = await page.evaluate(async () => {
        const anchor = document.querySelector("#PublicAccountant");
        if (!anchor) return [];

        const wrapper = anchor.closest(".anchor-wrp");
        if (!wrapper) return [];

        const table = wrapper.querySelector("table");
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll("tbody tr"));

        return rows.map((tr) => {
          const tds = tr.querySelectorAll("td");
          return {
            nama: tds[0]?.innerText.trim(),
          };
        });
      });

      const data = {
        logo,
        ...rows,
        "Sekretaris Perusahaan": sekretariat,
        Direktur: directors,
        Komisaris: commissioner,
        "Komite Audit": committee,
        "Pemegang Saham": shareholders,
        "Anak Perusahaan": subsidiary,
        "Akuntan Publik": publicAccountant,
      };

      const output = {
        total: Object.keys(data).length,
        data: data,
        scraped_at: new Date().toISOString(),
      };

      const parse = await parser(data);

      const outPath = resolveOutputPath(code);
      const outPathMin = resolveOutputPathMinify(code);

      fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
      fs.writeFileSync(
        outPathMin,
        JSON.stringify(
          {
            total: Object.keys(parse).length,
            data: parse,
            scraped_at: new Date().toISOString(),
          },
          null,
          2
        )
      );

      tester({ main: outPath, minify: outPathMin }, code);

      return output;
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
      await scrapeCorporateAction(code, page, options);
      ok++;
    } catch (err) {
      try {
        if (err.hardBlock || !/Cloudflare|blocked/.test(err.message)) throw err;

        console.log("♻️ Recreating browser session...");
        await destroySession();
        await createSession();

        // retry sekali pakai browser baru
        await scrapeCorporateAction(code, page, options);
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

  if (!options?.disableConsole) {
    console.log(`🎯 Done in ${(Date.now() - start) / 1000}s`);
  }

  return { ok, total: toScrape.length, failures, blocked };
}
