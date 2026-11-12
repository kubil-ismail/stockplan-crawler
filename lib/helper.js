export const CORPORATE_ACTION_MAP = {
  IPO: "IPO",
  CompanyListing: "IPO",

  HMETD: "RIGHTS_ISSUE",

  "Tanpa HMETD": "PRIVATE_PLACEMENT",
  "Private Placement": "PRIVATE_PLACEMENT",

  Waran: "WARRANT",

  "Stock Split": "STOCK_SPLIT",
  "Reverse Stock": "REVERSE_STOCK_SPLIT",

  "Saham Bonus": "BONUS_SHARE",
  "Dividen Saham": "STOCK_DIVIDEND",

  ESOP: "ESOP",
  MSOP: "MSOP",
  "ESOP/MSOP": "ESOP_MSOP",

  "Buyback Saham": "BUYBACK",

  "Gabung Usaha": "MERGER",

  KonversiSaham: "SHARE_CONVERSION",

  obligasiWajibKonversi: "MANDATORY_CONVERTIBLE_BOND",

  delist: "DELISTING",
  "Partial Delisting": "PARTIAL_DELISTING",
  partialRelisting: "RELISTING",

  TransaksiMaterial: "MATERIAL_TRANSACTION",

  "Kurang Modal": "CAPITAL_REDUCTION",
};


export const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = parseFloat(
    String(value).replace(/\./g, "").replace(",", ".").trim()
  );

  return Number.isFinite(parsed) ? parsed : null;
};


export const chunk = (arr, size) => {
  const result = [];

  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }

  return result;
};

// Jalankan scraper (yang sudah punya withRetry 3x di dalamnya). Kalau tetap diblokir Cloudflare,
// coba sekali lagi dengan browser terlihat (headless: false), yang lebih jarang diblokir.
export async function withHeadfulFallback(scrape, options) {
  try {
    return await scrape(options);
  } catch (err) {
    if (err?.hardBlock || !/Cloudflare|blocked/.test(err?.message) || options?.headless === false) throw err;
    console.log("♻️ Diblokir Cloudflare 3x, coba lagi dengan headless: false...");
    return scrape({ ...options, headless: false });
  }
}

// Halaman blokir WAF Cloudflare ("Sorry, you have been blocked"). Beda dengan tantangan "Just a moment":
// tidak bisa diselesaikan, dan retry hanya memperpanjang blokir. err.hardBlock menghentikan retry & fallback.
const HARD_BLOCK = /Sorry, you have been blocked|cf-error-details|data-translate="block_headline"/;

export async function assertNotHardBlocked(page) {
  const html = await page.content().catch(() => "");
  if (HARD_BLOCK.test(html)) {
    const err = new Error("Diblokir IDX (Cloudflare WAF). Berhenti tanpa retry; coba lagi beberapa jam lagi.");
    err.hardBlock = true;
    throw err;
  }
}

// Satu user-agent Chrome yang cocok dengan versi Chromium yang dipakai (bukan acak, bukan "HeadlessChrome").
export const chromeUA = (browser) =>
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;

// Pesan kegagalan untuk admin (AdminSinkron). Pesan teknis aslinya dikirim di `log`.
export function adminMessage(err) {
  const m = String(err?.message ?? err);
  if (err?.hardBlock) return "Diblokir BEI (Cloudflare). Coba lagi beberapa jam lagi."; // COPY: perlu review
  if (/Cloudflare|blocked|Timeout|timeout|net::ERR/.test(m)) return "Halaman profil BEI tidak bisa dibaca"; // COPY: perlu review
  return "Format halaman BEI berubah"; // COPY: perlu review
}
