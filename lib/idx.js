import { chromium } from "./browser.js";

let context;
let page;

export async function initIDX() {
  // persistent session
  context = await chromium.launchPersistentContext("./idx-session", {
    headless: false,
    executablePath: "/usr/bin/google-chrome-stable",
  });

  page = await context.newPage();

  // buka idx
  await page.goto("https://www.idx.co.id", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  console.log("");
  console.log("====================================");
  console.log("🛑 MANUAL VERIFICATION REQUIRED");
  console.log("====================================");
  console.log("1. Selesaikan verification di browser");
  console.log("2. Tunggu homepage IDX tampil normal");
  console.log("3. Tekan ENTER di terminal");
  console.log("====================================");
  console.log("");

  // tunggu enter terminal
  await new Promise((resolve) => {
    process.stdin.resume();

    process.stdin.once("data", () => {
      resolve();
    });
  });

  console.log("✅ Session saved");
}

export async function getIDXData(ticker) {
  if (!page) {
    await initIDX();
  }

  const targetUrl =
    `https://www.idx.co.id/id/perusahaan-tercatat/` +
    `profil-perusahaan-tercatat/${ticker}`;

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("GetCompanyProfilesDetail") &&
      response.url().includes(`KodeEmiten=${ticker}`),
    {
      timeout: 60000,
    }
  );

  // buka halaman normal
  await page.goto(targetUrl, {
    waitUntil: "networkidle",
    timeout: 120000,
  });

  const response = await responsePromise;

  const text = await response.text();

  // detect cloudflare
  if (
    text.includes("Just a moment") ||
    text.includes("security verification")
  ) {
    console.log(`🛑 Cloudflare blocked ${ticker}`);

    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.log(`❌ Invalid JSON ${ticker}`);

    return null;
  }
}
