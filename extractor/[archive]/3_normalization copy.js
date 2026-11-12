import path from "path";
import fs from "fs";

import migrate, { __dirname } from "../../lib/migrate.js";

const distFolder = path.resolve(__dirname, "../dist");
const globalFolder = path.resolve(__dirname, "../data/global");
const DEFAULT_LOGO_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#913132" d="M0 0h18v18H0z"/><path d="M9.36 3.86h.11c-.44.7-1.7 2.3-2.28 3.03-.08 0-.34-.05-.78-.17a28.5 28.5 0 0 1 2.95-2.86Zm-.9.01a5.14 5.14 0 0 0-3.9 2.52c.45.05 1.2.14 1.57.23.5-.36 1.63-1.8 2.34-2.75ZM4.34 6.84l-.18.42c1.21-.1 2.21.07 2.57.18l.23-.32a13.23 13.23 0 0 0-2.62-.28ZM4 7.78a5.13 5.13 0 0 0-.07.44c.9.7 2.76 2.22 2.93 2.62.4-.88.71-1.67.82-1.96.03.2.01.76-.24 1.43a9.19 9.19 0 0 1-.63 1.35l1.07 1.02c.26-.64.78-2 .83-2.37.1.27.01 1.05-.05 1.4l-.88 2.12a30.5 30.5 0 0 0 3.57-2.8 6.47 6.47 0 0 1-1.3 1.49 5.65 5.65 0 0 1-.7 1.61 5.14 5.14 0 0 0 4.09-2.53c-.79-.29-1.97-.7-2.62-.92-.04.11-.16.4-.35.7l.18-.7a1.29 1.29 0 0 1-.34-.14c.18-.08.4-.1.48-.1l.06-.45c-.4-.2-1.19-.47-1.52-.58l-.27.44c.02-.1.07-.33.13-.48-.13-.06-.37-.1-.47-.13.1-.02.34-.07.55-.07l.3-.85a15.79 15.79 0 0 0-2.85-.54c-.17.09-.49.2-.38 0a9.33 9.33 0 0 0-2.34 0Zm9.9 2.78c.1-.32.18-.66.21-1a19.21 19.21 0 0 0-2.1-2.77c-.03.25-.3 1.25-.44 1.72l.37.3a3.93 3.93 0 0 0-.4-.17c-.06.36-.29.9-.4 1.12l.87.37c.12-.12.47-.46.86-.81-.12-.03-.8-.33-1.12-.47.38.13 1.16.38 1.23.37.06 0 .2-.16.27-.23l-.12.28c.07.03.34.17.84.49l-.42-.17-.54-.22c-.1.15-.57.62-.8.85a4.21 4.21 0 0 0 1.7.34Zm.24-1.72a5.13 5.13 0 0 0-.45-1.96c-.26-.28-1.04-.97-1.45-1.33-.02.2-.08.68-.16 1.01a28.5 28.5 0 0 1 2.06 2.28Zm-.9-2.76a5.18 5.18 0 0 0-.93-1.03l-.07.4 1 .63Zm-1.44-1.4c-.02.4-.05 1.08-.1 1.51-.19-.11-.75-.6-1-.82.28.32.88.97 1 1.04-.06.59-.3 1.58-.42 2l-1.06-.4c.34.12 1 .4 1.03.5.02.1-.19.84-.3 1.2-.4-.19-1-.42-1.54-.54.11-.32.22-.6.28-.74l.03-.07 1.29.32a6.12 6.12 0 0 0-1.22-.5c.28-.46.85-1.9.9-4.05.4.14.77.32 1.11.54Zm-2.5 9.45c.03-.06.08-.15.1-.23l.19-.45c.15-.34.32-.73.33-.87l-1.78 1.5a5.18 5.18 0 0 0 1.16.05Zm-2-.28.48-.9-1.1-.93-.51 1.27c.35.23.72.42 1.12.56Zm-1.64-.94.72-1.07c-.17-.17-.89-.73-2.37-1.61.26 1.06.85 1.99 1.65 2.68ZM3.87 9.38l2.72 2.13.17-.46c-.76-.67-2.3-2-2.9-2.34a5.24 5.24 0 0 0 .01.67Zm7.05 1.07.12-.4c.26.1 1.03.45 1.96 1.03a9.7 9.7 0 0 0-2.08-.63Zm-3.8-3.01.24-.25c.22.03.95.2 2.1.6A7.29 7.29 0 0 0 7.58 7c.48-.61 1.67-2.05 2.55-2.9a9.43 9.43 0 0 1-.53 4.03c-.86-.28-1.87-.54-2.48-.7Z" fill="#fff"/></svg>`;

function slugify(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toSmartTitleCase(value) {
  const uppercaseWords = [
    "PT",
    "Tbk",
    "RUPS",
    "EGMS",
    "AGMS",
    "AIP",
    "KS",
    "MH",
    "MT",
    "SCBD",
    "SCTV",
    "HMETD",
    "DPS",
    "AKR",
    "MDTV",
    "IDR",
    "USD",
  ];

  const lowercaseWords = [
    "dan",
    "di",
    "ke",
    "dari",
    "yang",
    "untuk",
    "dengan",
    "atau",
    "pada",
    "dalam",
    "oleh",
    "sebagai",
    "karena",
    "agar",
    "hingga",
    "antara",
  ];

  let normalized = normalizeText(value);

  // typo & normalization
  const replacements = {
    "\\bPt Pt\\b": "PT",
    "\\bElectronik\\b": "Elektronik",
    "Easy\\.ksei": "eASY.KSEI",
    "Https://": "https://",
  };

  for (const [pattern, replacement] of Object.entries(replacements)) {
    normalized = normalized.replace(new RegExp(pattern, "gi"), replacement);
  }

  normalized = normalized.toLowerCase();

  return normalized
    .split(" ")
    .map((word, index) => {
      // preserve URL
      if (word.startsWith("http://") || word.startsWith("https://")) {
        return word;
      }

      // preserve roman numerals
      if (/^(ii|iii|iv|vi|vii|viii|ix|x)$/i.test(word)) {
        return word.toUpperCase();
      }

      const clean = word.replace(/[^a-zA-Z]/g, "");

      // uppercase special words
      const upper = uppercaseWords.find(
        (item) => item.toLowerCase() === clean.toLowerCase(),
      );

      if (upper) {
        return word.replace(clean, upper);
      }

      // lowercase connector words
      if (index !== 0 && lowercaseWords.includes(clean)) {
        return word;
      }

      // capitalize first character
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/No\.(\d+)/g, "No. $1")
    .replace(/Jl (?=[A-Z])/g, "Jl. ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercentage(value) {
  if (value === null || value === undefined) return 0;

  let cleaned = String(value).replace(/%/g, "").replace(/\s+/g, "").trim();

  // format indo: 99,99
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    cleaned = cleaned.replace(",", ".");
  }

  // format campur: 1.234,56
  else if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(cleaned);

  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeWebsite(value) {
  if (!value) return null;

  let website = String(value).trim();

  // hapus spasi
  website = website.replace(/\s+/g, "");

  // tambahin protocol kalau belum ada
  if (!/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  // normalize protocol lowercase
  website = website.replace(/^HTTP:\/\//i, "http://");
  website = website.replace(/^HTTPS:\/\//i, "https://");

  // hapus slash di akhir
  website = website.replace(/\/+$/, "");

  return website;
}

function isInvalidPersonName(name = "") {
  const text = name.toLowerCase().trim();

  const invalidNames = [
    "",
    "-",
    "--",
    "---",
    "0",
    "null",
    "n/a",
    "na",
    ".",
    "..",
    "...",
  ];

  return invalidNames.includes(text);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  let str = String(value).trim();

  // format indo decimal
  // 1.234,56
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  }

  // format indo integer
  // 1.234.567
  else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }

  // format us
  // 1,234,567.89
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, "");
  }

  const result = Number(str);

  return Number.isNaN(result) ? 0 : result;
}

function normalizeText(value) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ");
}

function normalizeJson(data = [], mapper = (item) => item) {
  return {
    total: data.length,
    data: data.map(mapper),
  };
}

function formatCorporateActionType(value) {
  const mapping = {
    obligasiwajibkonversi: "Obligasi Wajib Konversi",
    stocksplit: "Stock Split",
    partialdelisting: "Partial Delisting",
    delist: "Delisting",
    sahambonus: "Saham Bonus",
    dividensaham: "Dividen Saham",
    gabungusaha: "Gabung Usaha",
    kurangmodal: "Kurang Modal",
    tanpahmetd: "Tanpa HMETD",
    hmetd: "HMETD",
    ipo: "IPO",
    waran: "Waran",
  };

  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return mapping[normalized] || toSmartTitleCase(value);
}

function readJson(folder, fileName) {
  const filePath = path.join(distFolder, folder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(raw);
}

function readJsonCompanyDetail(fileName) {
  const filePath = path.join(distFolder, "company", "detail", fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function readJsonDataGlobal(fileName) {
  const filePath = path.join(globalFolder, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

function writeJson(folder, fileName, data, minify = false) {
  const filePath = path.join(distFolder, folder, fileName);

  if (minify) {
    fs.writeFileSync(filePath, JSON.stringify(data));
  } else {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}

function writeJsonCompanyDetail(fileName, data) {
  const filePath = path.join(distFolder, "company", "detail", fileName);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeCalendar(data) {
  return normalizeJson(data, (item) => ({
    ticker: normalizeText(item.kode).toUpperCase(),
    perihal: toSmartTitleCase(item.perihal),
    lokasi: toSmartTitleCase(item.lokasi),
    tanggal: normalizeText(item.tanggal),
  }));
}

function normalizeCorporateActions(data) {
  return normalizeJson(data, (item) => ({
    date: normalizeText(item.Tanggal),
    ticker: normalizeText(item.Kode_Emiten).toUpperCase(),
    corporate_action_type: toSmartTitleCase(
      formatCorporateActionType(item.Tipe_Aksi_Korporasi),
    ),
    action_amount: parseNumber(item.Jumlah_Aksi_Korporasi),
    total_shares: parseNumber(item.Jumlah_Total),
  }));
}

function cleanSvg(svg) {
  if (!svg) return "";

  return String(svg)
    .replace(/<!--[\s\S]*?TradingView[\s\S]*?-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeNotation(data) {
  return normalizeJson(data, (item) => {
    const notationCodes = normalizeText(item.Notasi)
      ?.split(",")
      ?.map((x) => x.trim())
      ?.filter(Boolean);

    const rawDescriptions =
      typeof item.Keterangan_Notasi === "string"
        ? item.Keterangan_Notasi.trim()
        : "";

    const notationDescriptions = rawDescriptions
      ?.split("\n")
      ?.map((line) => line.trim())
      ?.filter(Boolean)
      ?.map((line) => {
        const [code, ...desc] = line.split(":");

        return {
          code: normalizeText(code),
          description: normalizeText(desc.join(":")),
        };
      });

    return {
      ticker: normalizeText(item.Kode).toUpperCase(),

      company_name: toSmartTitleCase(item.Nama),

      notation_codes: notationCodes,

      notation_descriptions: notationDescriptions,
    };
  });
}

function normalizeSpecialBoard(data, notationData) {
  const SPECIAL_MONITORING_BOARD_CRITERIA = {
    1: "Harga saham rendah dan likuiditas rendah",
    2: "Opini disclaimer pada laporan keuangan",
    3: "Tidak ada atau tidak berubahnya pendapatan",
    4: "Perusahaan tambang belum menghasilkan pendapatan inti",
    5: "Ekuitas negatif",
    6: "Tidak memenuhi ketentuan free float",
    7: "Likuiditas saham rendah",
    8: "PKPU, pailit, atau pembatalan perdamaian",
    9: "Anak perusahaan material mengalami PKPU/pailit",
    10: "Suspensi perdagangan lebih dari 1 hari bursa",
    11: "Kondisi lain berdasarkan keputusan Bursa/OJK",
  };

  return normalizeJson(data, (item) => {
    const criteria = normalizeText(item.Kriteria)
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Boolean);

    return {
      ticker: normalizeText(item.Kode_Saham).toUpperCase(),

      company_name: toSmartTitleCase(item.Nama_Perusahaan),

      entry_date: normalizeText(item.Tanggal_Masuk),

      criteria_details: criteria.map((code) => ({
        code,
        description: SPECIAL_MONITORING_BOARD_CRITERIA[code] || null,
      })),

      notation: notationData?.find(
        (_item) =>
          _item.ticker === normalizeText(item.Kode_Saham).toUpperCase(),
      )?.notation_descriptions,
    };
  });
}

function generateBusinessProfile(detail = {}) {
  const sourceTexts = [
    detail["Bidang Usaha Utama"],
    detail["Industri"],
    detail["Subindustri"],
    detail["Sektor"],
    detail["Subsektor"],
    ...(detail["Anak Perusahaan"] || []).flatMap((item) => [
      item.nama,
      item.jenis,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags = new Set();
  const keywords = new Set();

  const businessMappings = [
    {
      tag: "Kelapa Sawit",
      keywords: ["kelapa sawit", "palm oil", "cpo"],
    },

    {
      tag: "Agribisnis",
      keywords: ["perkebunan", "agriculture", "plantation", "agribusiness"],
    },

    {
      tag: "Karet",
      keywords: ["karet", "rubber"],
    },

    {
      tag: "Batubara",
      keywords: ["batubara", "coal", "mining"],
    },

    {
      tag: "Perbankan",
      keywords: ["bank", "banking"],
    },

    {
      tag: "Teknologi",
      keywords: ["technology", "teknologi", "software", "digital", "internet"],
    },

    {
      tag: "Telekomunikasi",
      keywords: ["telekomunikasi", "telecommunication", "tower", "fiber optic"],
    },

    {
      tag: "Kesehatan",
      keywords: [
        "hospital",
        "rumah sakit",
        "healthcare",
        "farmasi",
        "pharmacy",
      ],
    },

    {
      tag: "Properti",
      keywords: ["property", "real estate", "properti"],
    },

    {
      tag: "Energi",
      keywords: ["energi", "energy", "oil", "gas"],
    },

    {
      tag: "Logistik",
      keywords: ["logistik", "logistics", "shipping", "transportasi"],
    },

    {
      tag: "Konstruksi",
      keywords: ["construction", "konstruksi", "infrastruktur"],
    },

    {
      tag: "Manufaktur",
      keywords: ["manufacturing", "manufaktur", "factory", "industrial"],
    },

    {
      tag: "Makanan & Minuman",
      keywords: ["food", "beverage", "makanan", "minuman"],
    },

    {
      tag: "Retail",
      keywords: ["retail", "supermarket", "consumer"],
    },

    {
      tag: "Otomotif",
      keywords: ["automotive", "otomotif", "kendaraan"],
    },

    {
      tag: "Media",
      keywords: ["media", "televisi", "broadcast", "streaming"],
    },

    {
      tag: "Keuangan",
      keywords: ["financial", "finance", "pembiayaan", "asuransi"],
    },
  ];

  for (const item of businessMappings) {
    const matched = item.keywords.some((keyword) =>
      sourceTexts.includes(keyword),
    );

    if (!matched) continue;

    tags.add(item.tag);

    item.keywords.forEach((keyword) => {
      keywords.add(keyword);
    });
  }

  // fallback kalau ga ada match
  if (tags.size === 0) {
    tags.add(
      toSmartTitleCase(
        detail["Subindustri"] ||
          detail["Industri"] ||
          detail["Bidang Usaha Utama"] ||
          "Lainnya",
      ),
    );
  }

  const summary = "Perusahaan bergerak di bidang " + [...tags].join(", ") + ".";

  return {
    raw_business: detail["Bidang Usaha Utama"],

    business_summary: summary,

    business_tags: [...tags],

    business_keywords: [...keywords],
  };
}

function normalizeCompanies(data) {
  const industries = readJsonDataGlobal("industries.json");
  const subIndustries = readJsonDataGlobal("sub_industries.json");
  const sectors = readJsonDataGlobal("sectors.json");
  const subSectors = readJsonDataGlobal("sub_sectors.json");

  // const technical = readJson("company", "technical_summary.json");

  return normalizeJson(data, (item) => {
    const ticker = normalizeText(item?.kode).toUpperCase();

    const detailCompany = readJsonCompanyDetail(`${ticker}.json`);
    const technicalSummary = technical.data?.find(
      (_item) => _item.Kode_Saham === ticker,
    );

    const mapping = {
      ticker,

      company_name: toSmartTitleCase(item.nama),

      listed_at: normalizeText(item.tanggal),

      listing_board: toSmartTitleCase(detailCompany.data?.["Papan Pencatatan"]),

      business_field: generateBusinessProfile(detailCompany.data),

      industry: industries.find(
        (industry) => industry.name === detailCompany.data?.["Industri"],
      ),

      sub_industry: subIndustries.find(
        (subIndustry) =>
          subIndustry.name === detailCompany.data?.["Subindustri"],
      ),

      sector: sectors.find(
        (sector) => sector.name === detailCompany.data?.["Sektor"],
      ),

      sub_sector: subSectors.find(
        (subSector) => subSector.name === detailCompany.data?.["Subsektor"],
      ),
    };

    normalizeDetailCompanies(mapping, detailCompany, technicalSummary);

    return mapping;
  });
}

function normalizeDetailCompanies(data, detail, technical) {
  const mapping = {
    company_name: toSmartTitleCase(detail.data?.Nama),
    ticker: normalizeText(detail.data?.Kode).toUpperCase(),

    office_address: toSmartTitleCase(detail.data?.["Alamat Kantor"]),
    email: normalizeText(detail.data?.["Alamat Email"]).toLowerCase(),
    phone: normalizeText(detail.data?.Telepon),
    fax: normalizeText(detail.data?.Fax),
    tax_id: normalizeText(detail.data?.NPWP),

    website: normalizeWebsite(detail.data?.Situs),

    listing_date: normalizeText(detail.data?.["Tanggal Pencatatan"]),
    listing_board: toSmartTitleCase(detail.data?.["Papan Pencatatan"]),

    business_field: data.business_field,

    sector: data.sector,
    sub_sector: data.sub_sector,
    industry: data.industry,
    sub_industry: data.sub_industry,

    corporate_secretary: detail.data?.["Sekretaris Perusahaan"]
      ? {
          name: toSmartTitleCase(detail.data["Sekretaris Perusahaan"]?.Nama),
          email: normalizeText(
            detail.data["Sekretaris Perusahaan"]?.["Alamat Email"],
          ).toLowerCase(),
          phone: normalizeText(
            detail.data["Sekretaris Perusahaan"]?.["Nomor Telepon"],
          ),
        }
      : null,

    directors: (detail.data?.Direktur || []).map((item) => ({
      name: toSmartTitleCase(item.nama),
      position: toSmartTitleCase(item.posisi),
      affiliated: item.terafiliasi === "Ya",
    })),

    commissioners: (detail.data?.Komisaris || []).map((item) => ({
      name: toSmartTitleCase(item.nama),
      position: toSmartTitleCase(item.posisi),
      affiliated: item.terafiliasi === "Ya",
    })),

    audit_committee: (detail.data?.["Komite Audit"] || []).map((item) => ({
      name: toSmartTitleCase(item.nama),
      position: toSmartTitleCase(item.posisi),
    })),

    shareholders: (detail.data?.["Pemegang Saham"] || [])
      .map((item) => ({
        name: toSmartTitleCase(item.nama),
        type: toSmartTitleCase(item.tipe),
        shares: parseNumber(item.jumlah),
        percentage: parsePercentage(item.persentase),
      }))
      .sort((a, b) => b.percentage - a.percentage),

    subsidiaries: (detail.data?.["Anak Perusahaan"] || [])
      .filter(
        (item) =>
          item.nama && item.nama !== "Data anak perusahaan tidak ditemukan",
      )
      .map((item) => ({
        name: toSmartTitleCase(item.nama),
        business_type: toSmartTitleCase(item.jenis),
        total_assets: parseNumber(item["aset total"]),
        ownership_percentage: parsePercentage(item.persentase),
      }))
      .sort((a, b) => b.total_assets - a.total_assets),

    public_accountants: (detail.data?.["Akuntan Publik"] || []).map((item) => ({
      name: toSmartTitleCase(item.nama || item),
    })),

    technical: {
      per: technical?.Per,
      pbv: technical?.Pbv,
      roe: technical?.Roe,
      roa: technical?.Roa,
      der: technical?.Der,
      mkt_cap: technical?.Mkt_Cap,
      total_rev: technical?.Total_Rev,
      _4_wk_chg: technical?._4_wk_chg,
      _13_wk_chg: technical?._13_wk_chg,
      _26_wk_chg: technical?._26_wk_chg,
      _52_wk_chg: technical?._52_wk_chg,
      npm: technical?.npm,
      mtd: technical?.mtd,
      ytd: technical?.ytd,
    },

    scraped_at: detail.scraped_at || null,
  };

  writeJsonCompanyDetail(`${data.ticker}.json`, mapping);
  ensureCompanyLogo(data.ticker);
}

function ensureCompanyLogo(kode) {
  const logoDir = path.join(distFolder, "company", "logo");

  const pngPath = path.join(logoDir, `${kode}.png`);
  const svgPath = path.join(logoDir, `${kode}.svg`);

  const hasPng = fs.existsSync(pngPath);
  const hasSvg = fs.existsSync(svgPath);

  // cleanup existing svg
  if (hasSvg) {
    const rawSvg = fs.readFileSync(svgPath, "utf8");
    const cleanedSvg = cleanSvg(rawSvg);

    if (rawSvg !== cleanedSvg) {
      fs.writeFileSync(svgPath, cleanedSvg, "utf8");
    }

    return true;
  }

  // existing png
  if (hasPng) {
    return true;
  }

  // create default svg
  fs.writeFileSync(svgPath, cleanSvg(DEFAULT_LOGO_SVG), "utf8");

  console.warn(`⚠️ Logo ${kode} tidak ditemukan, default logo berhasil dibuat`);

  return true;
}

function detectEntityCategory(name = "") {
  const text = name.toLowerCase().trim();

  /*
  |--------------------------------------------------------------------------
  | PEMERINTAH / NEGARA
  |--------------------------------------------------------------------------
  */
  const governmentPatterns = [
    /\bnegara republik indonesia\b/i,
    /\brepublic of indonesia\b/i,
    /\bpemerintah\b/i,
    /\bgovernment\b/i,

    /\bkementerian\b/i,
    /\bkementrian\b/i,

    /\bpemprov\b/i,
    /\bpemkab\b/i,
    /\bpemkot\b/i,

    /\bprovinsi\b/i,
    /\bkabupaten\b/i,

    // hati-hati "kota" terlalu generic
    /\bkota\b/i,

    /\bkejaksaan\b/i,
    /\bmahkamah\b/i,
    /\bkepolisian\b/i,
    /\bpolri\b/i,
    /\btni\b/i,

    /\bdpr\b/i,
    /\bmpr\b/i,
    /\bdpd\b/i,
    /\bkpk\b/i,
    /\bkppu\b/i,
    /\bbpk\b/i,
    /\bbappenas\b/i,

    /\bbank indonesia\b/i,
    /\bojk\b/i,
    /\botoritas\b/i,

    /\bbpjs\b/i,

    /\bindonesia investment authority\b/i,
  ];

  if (governmentPatterns.some((regex) => regex.test(text))) {
    return "negara";
  }

  /*
  |--------------------------------------------------------------------------
  | BUMN
  |--------------------------------------------------------------------------
  */

  const bumnPatterns = [
    /\bpersero\b/i,
    /\basabri\b/i,
    /\btaspen\b/i,
    /\bpertamina\b/i,
    /\bpln\b/i,
    /\btelkom indonesia\b/i,
    /\bbio farma\b/i,
    /\bkimia farma\b/i,
    /\bpegadaian\b/i,
    /\bpupuk indonesia\b/i,
    /\bpelni\b/i,
    /\binka\b/i,
    /\bkai\b/i,
  ];

  if (bumnPatterns.some((regex) => regex.test(text))) {
    return "bumn";
  }

  /*
  |--------------------------------------------------------------------------
  | PERBANKAN
  |--------------------------------------------------------------------------
  */

  const bankKeywords = [
    "bank",

    "bca",
    "bri",
    "bni",
    "btn",

    "mandiri",

    "cimb",
    "danamon",
    "permata",
    "maybank",
    "ocbc",
    "uob",
    "panin",
    "amon",
    "hsbc",
    "standard chartered",
    "citibank",
    "dbs",
  ];

  if (bankKeywords.some((x) => text.includes(x))) {
    return "perbankan";
  }

  /*
  |--------------------------------------------------------------------------
  | SEKURITAS
  |--------------------------------------------------------------------------
  */

  const securitiesKeywords = [
    "sekuritas",
    "securities",
    "broker",
    "asset management",
    "manajemen investasi",
  ];

  if (securitiesKeywords.some((x) => text.includes(x))) {
    return "sekuritas";
  }

  /*
  |--------------------------------------------------------------------------
  | ASURANSI
  |--------------------------------------------------------------------------
  */

  const insuranceKeywords = ["asuransi", "insurance", "assurance"];

  if (insuranceKeywords.some((x) => text.includes(x))) {
    return "asuransi";
  }

  /*
  |--------------------------------------------------------------------------
  | REKSADANA / FUND
  |--------------------------------------------------------------------------
  */

  const fundKeywords = [
    "fund",
    "reksadana",
    "mutual fund",
    "capital",
    "ventures",
    "investment",
    "investama",
    "partners",
    "asset management",
  ];

  if (fundKeywords.some((x) => text.includes(x))) {
    return "investasi";
  }

  /*
  |--------------------------------------------------------------------------
  | PERUSAHAAN
  |--------------------------------------------------------------------------
  */

  const companyPatterns = [
    /\bpt\b/i,
    /\btbk\b/i,
    /\bcorp\b/i,
    /\bcorporation\b/i,
    /\binc\b/i,
    /\bltd\b/i,
    /\blimited\b/i,
    /\bholding\b/i,
    /\bgroup\b/i,
    /\binternational\b/i,
    /\benterprise\b/i,
    /\bfoundation\b/i,
    /\bllc\b/i,
    /\bplc\b/i,
    /\bpte\b/i,
    /\bnv\b/i,
    /\bsa\b/i,
  ];

  if (companyPatterns.some((regex) => regex.test(text))) {
    return "perusahaan";
  }

  /*
  |--------------------------------------------------------------------------
  | DEFAULT = PERORANGAN
  |--------------------------------------------------------------------------
  */

  return "perorangan";
}

function generate_shareholder_company() {
  const company = readJson("company", "company.json");

  const EXCLUDED_SHAREHOLDERS = [
    "Saham Treasury",
    "Masyarakat Non Warkat",
    "Masyarakat Warkat",
    "Masyarakat",
    "Pengendali Saham",
    "Non Pengendali Saham",
    "-",
    "0",
  ];

  const excluded = EXCLUDED_SHAREHOLDERS.map((x) => x.toLowerCase());

  const map = {};
  const companyMap = {};

  normalizeJson(company.data, (item) => {
    companyMap[item.ticker] = item;
  });

  function ensurePerson(name) {
    if (!name) return null;

    const cleanName = name.trim();

    if (!cleanName) return null;

    if (cleanName === "-") {
      return null;
    }

    const slug = slugify(cleanName);

    if (!map[slug]) {
      map[slug] = {
        name: cleanName,
        slug,

        category: detectEntityCategory(cleanName),

        // summary
        total_company: 0,

        summary: {
          shareholder: 0,
          director: 0,
          commissioner: 0,
          audit_committee: 0,
        },

        // flags
        roles: [],

        // companies
        companies: [],

        keywords: [],
      };
    }

    return map[slug];
  }

  function generateKeywords(person) {
    const keywords = new Set();

    /*
    |--------------------------------------------------------------------------
    | PERSON NAME
    |--------------------------------------------------------------------------
    */
    if (person.name) {
      keywords.add(person.name.toLowerCase());
    }

    /*
    |--------------------------------------------------------------------------
    | COMPANY
    |--------------------------------------------------------------------------
    */

    person.companies.forEach((company) => {
      if (company.ticker) {
        keywords.add(company.ticker.toLowerCase());
      }

      if (company.name) {
        keywords.add(company.name.toLowerCase());
      }
    });

    return Array.from(keywords);
  }

  function ensureCompany(person, ticker) {
    let company = person.companies.find((item) => item.ticker === ticker);
    const companyInfo = companyMap[ticker] || {};

    if (!company) {
      company = {
        ticker,
        name: companyInfo.company_name,

        roles: [],

        shareholder: null,
        director: null,
        commissioner: null,
        audit_committee: null,
      };

      person.companies.push(company);
    }

    return company;
  }

  normalizeJson(company.data, (item) => {
    const ticker = item.ticker;

    const detailCompany = readJsonCompanyDetail(`${ticker}.json`);

    /*
    |--------------------------------------------------------------------------
    | SHAREHOLDERS
    |--------------------------------------------------------------------------
    */

    const shareholders = detailCompany?.shareholders || [];

    for (const shareholder of shareholders) {
      const name = shareholder?.name?.trim();

      if (isInvalidPersonName(name)) {
        continue;
      }

      if (excluded.includes(name.toLowerCase())) {
        continue;
      }

      const person = ensurePerson(name);

      if (!person) continue;

      const companyItem = ensureCompany(person, ticker);

      if (!person.roles.includes("shareholder")) {
        person.roles.push("shareholder");
      }

      if (!companyItem.roles.includes("shareholder")) {
        companyItem.roles.push("shareholder");

        person.summary.shareholder++;
      }

      companyItem.shareholder = {
        percentage: shareholder?.percentage || 0,
        shares: shareholder?.shares || 0,
        type: shareholder?.type || "",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | DIRECTORS
    |--------------------------------------------------------------------------
    */

    const directors = detailCompany?.directors || [];

    for (const director of directors) {
      const name = director?.name?.trim();

      if (!name) continue;

      const person = ensurePerson(name);

      if (!person) continue;

      const companyItem = ensureCompany(person, ticker);

      if (!person.roles.includes("director")) {
        person.roles.push("director");
      }

      if (!companyItem.roles.includes("director")) {
        companyItem.roles.push("director");

        person.summary.director++;
      }

      companyItem.director = {
        title: director?.position || "",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | COMMISSIONERS
    |--------------------------------------------------------------------------
    */

    const commissioners = detailCompany?.commissioners || [];

    for (const commissioner of commissioners) {
      const name = commissioner?.name?.trim();

      if (!name) continue;

      const person = ensurePerson(name);

      if (!person) continue;

      const companyItem = ensureCompany(person, ticker);

      if (!person.roles.includes("commissioner")) {
        person.roles.push("commissioner");
      }

      if (!companyItem.roles.includes("commissioner")) {
        companyItem.roles.push("commissioner");

        person.summary.commissioner++;
      }

      companyItem.commissioner = {
        title: commissioner?.position || "",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | AUDIT COMMITTEE
    |--------------------------------------------------------------------------
    */

    const auditCommittees = detailCompany?.audit_committee || [];

    
    // if (detailCompany.ticker === "AADI") {
    //   console.log("auditCommittees", auditCommittees);
    // }

    for (const audit of auditCommittees) {
      const name = audit?.name?.trim();

      if (!name) continue;

      const person = ensurePerson(name);

      if (!person) continue;

      const companyItem = ensureCompany(person, ticker);

      if (!person.roles.includes("audit_committee")) {
        person.roles.push("audit_committee");
      }

      if (!companyItem.roles.includes("audit_committee")) {
        companyItem.roles.push("audit_committee");

        person.summary.audit_committee++;
      }

      companyItem.audit_committee = {
        title: `${audit?.position} Komite Audit` || "",
      };
    }
  });

  /*
  |--------------------------------------------------------------------------
  | FINALIZE
  |--------------------------------------------------------------------------
  */

  const result = Object.values(map).map((item) => {
    // sort company berdasarkan shares terbesar
    item.companies.sort((a, b) => {
      return (
        Number(b?.shareholder?.shares || 0) -
        Number(a?.shareholder?.shares || 0)
      );
    });

    item.total_company = item.companies.length;

    // generate search keywords
    item.keywords = generateKeywords(item);

    return item;
  });

  // ranking orang paling connected
  result.sort((a, b) => b.total_company - a.total_company);

  writeJson("company", "min-shareholders.json", result, true);
  writeJson("company", "shareholders.json", result);
}

function main() {
  // // calendar.json
  // const calendar = readJson("information", "calendar.json");
  // const normalizedCalendar = normalizeCalendar(calendar.data);

  // console.log("=== CALENDAR ===");
  // writeJson("information", "calendar.json", normalizedCalendar);

  // // corporate_actions.json
  // const corporateActions = readJson("information", "corporate_actions.json");
  // const normalizedCorporateActions = normalizeCorporateActions(
  //   corporateActions.data,
  // );

  // console.log("=== CORPORATE ACTIONS ===");
  // writeJson(
  //   "information",
  //   "corporate_actions.json",
  //   normalizedCorporateActions,
  // );
  // writeJson(
  //   "information",
  //   "min-corporate_actions.json",
  //   normalizedCorporateActions,
  //   true,
  // );

  // // notation.json
  // const notation = readJson("information", "notation.json");
  // const normalizedNotation = normalizeNotation(notation.data);

  // console.log("=== NOTATIONS ===");
  // writeJson("information", "notation.json", normalizedNotation);
  // writeJson("information", "min-notation.json", normalizedNotation, true);

  // // special_board.json
  // const specialBoard = readJson("information", "special_board.json");
  // const normalizedSpecialBoard = normalizeSpecialBoard(
  //   specialBoard.data,
  //   normalizedNotation.data,
  // );

  // console.log("=== PEMANTAUAN KHUSUS ===");
  // writeJson("information", "special_board.json", normalizedSpecialBoard);
  // writeJson(
  //   "information",
  //   "min-special_board.json",
  //   normalizedSpecialBoard,
  //   true,
  // );

  // company.json
  const company = readJson("company", "company.json");
  const normalizedCompany = normalizeCompanies(company.data);

  console.log

  // console.log("=== COMPANY ===");
  // writeJson("company", "company.json", normalizedCompany);
  // writeJson("company", "min-company.json", normalizedCompany, true);

  // // shareholders.json
  // const generate_shareholder = generate_shareholder_company();
}

main();
