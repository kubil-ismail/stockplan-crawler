import path from "path";
import fs from "fs";

import { __dirname } from "../../lib/migrate.js";

function readJsonDataGlobal(fileName) {
  const globalFolder = path.resolve(__dirname, "../data/global");
  const filePath = path.join(globalFolder, fileName);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");

  return JSON.parse(raw);
}

const removeWord = (text = "", blacklist = []) => {
  return text
    .split(" ")
    .filter((word) => !blacklist.includes(word.toLowerCase()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const uppercaseWord = (text = "") => text.trim().toUpperCase();
const lowercaseWord = (text = "") => text.trim().toLowerCase();
const capitalizeWord = (text = "") =>
  text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const cleanDisplayName = (name = "") =>
  String(name)
    .replace(/^(mr|mrs|ms)\.?/gi, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizePersonName = (name = "") => {
  let result = String(name).toLowerCase().trim();

  /*
      |--------------------------------------------------------------------------
      | PERSON
      |--------------------------------------------------------------------------
      */

  return (
    result
      .replace(
        /\b(mr|mrs|ms|dr|prof|ir|haji|hj|h|hc|s\.?kom|se|mba|phd)\b\.?/gi,
        ""
      )

      // hapus simbol depan
      .replace(/^[^a-z0-9]+/gi, "")

      // hapus simbol belakang
      .replace(/[^a-z0-9]+$/gi, "")

      // normalize separator
      .replace(/[^a-z0-9\s]/gi, " ")

      // rapihin spasi
      .replace(/\s+/g, " ")
      .trim()
  );
};

export const getSlug = (text = "") => {
  const EXCLUDED_SHAREHOLDERS = [
    "Saham Treasury",
    "Masyarakat Non Warkat",
    "Masyarakat Warkat",
    "Masyarakat",
    "Pengendali Saham",
    "Non Pengendali Saham",
    "-",
    "0",
    "AFILIASI PENGENDALI",
    "afiliasi",
  ];

  if (
    EXCLUDED_SHAREHOLDERS.some(
      (item) => item.toLowerCase() === text.toLowerCase()
    )
  ) {
    return "#";
  }

  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accent
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ") // remove symbol
    .replace(/\s+/g, "-") // space -> -
    .replace(/-+/g, "-") // multiple - -> single -
    .replace(/^-+|-+$/g, "") // trim -
    .toLowerCase();
};

const getCompanyName = (idx = {}) => {
  const blacklist = [
    "tbk",
    "tbk.",
    "ltd",
    "ltd.",
    "inc",
    "inc.",
    "corp",
    "corp.",
    "corporation",
    "company",
    "co",
    "co.",
    "pt",
    "pt.",
  ];

  return {
    shortName: removeWord(capitalizeWord(idx?.Nama), blacklist) ?? null,
    longName: capitalizeWord(idx?.Nama),
  };
};

const getSector = (sectors, subSectors, idx_sector, idx_sub_sector) => {
  return {
    ...sectors?.find(
      (item) => lowercaseWord(item.name?.id) === lowercaseWord(idx_sector)
    ),
    sub_sector: getSubSector(subSectors, idx_sub_sector),
  };
};

const getSubSector = (subSectors, idx_sub_sector) => {
  return subSectors?.find(
    (item) => lowercaseWord(item.name?.id) === lowercaseWord(idx_sub_sector)
  );
};

const getIndustry = (
  industries,
  subIndustries,
  idx_industry,
  idx_sub_industry
) => {
  return {
    ...industries?.find(
      (item) => lowercaseWord(item.name?.id) === lowercaseWord(idx_industry)
    ),
    sub_industry: getSubIndustry(subIndustries, idx_sub_industry),
  };
};

const getSubIndustry = (subIndustries, idx_sub_industry) => {
  return subIndustries?.find(
    (item) => lowercaseWord(item.name?.id) === lowercaseWord(idx_sub_industry)
  );
};

export const getWebsite = (url) => {
  if (!url) return { link: null, valid: false };

  let link = url.trim();

  // remove trailing slash
  link = link.replace(/\/+$/, "");

  // ensure protocol
  if (!/^https?:\/\//i.test(link)) {
    link = `https://${link}`;
  }

  // remove www
  link = link.replace(/^https?:\/\/www\./i, "https://");

  return {
    link,
    valid: link ? true : false,
  };
};

export const getAddress = (idx) => {
  return {
    address1: null,
    address2: null,
    city: null,
    zip: null,
    country: null,
    main_address: capitalizeWord(idx?.["Alamat Kantor"]) || null,
  };
};

export const getBoard = (idx) => {
  return {
    name: capitalizeWord(idx?.["Papan Pencatatan"]),
    code: "",
  };
};

export const getBusinessField = (idx) => {
  return {
    raw_business: idx?.["Bidang Usaha Utama"],
    business_summary: { id: "", en: "" },
    multi_language: true,
    default_laguange: "id",
    business_tags: [],
    business_keywords: [],
  };
};

export const getCorporateSecretary = (idx) => {
  return {
    name: capitalizeWord(idx?.["Sekretaris Perusahaan"]?.Nama),
    email: idx?.["Alamat Email"]
      ?.split(/[,/]/)
      ?.map((item) => item.trim())
      ?.filter(Boolean),
    phone: idx?.["Sekretaris Perusahaan"]?.["Nomor Telepon"]
      ?.split(/[/]/)
      ?.map((item) => item.trim())
      ?.filter(Boolean),
  };
};

export const getDirectors = (idx) => {
  const normalizeName = (name = "") =>
    name
      .replace(
        /^(mr|mrs|ms|dr|prof|ir|haji|hj|h\.|hc|s\.kom|se|mba|phd)\.?/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isDirector = (position = "") => {
    const pos = position.toLowerCase();

    return (
      pos.includes("direktur") ||
      pos.includes("wakil direktur") ||
      pos.includes("direktur utama") ||
      pos.includes("presiden direktur") ||
      pos.includes("director") ||
      pos.includes("vice director") ||
      pos.includes("managing director") ||
      pos.includes("president director")
    );
  };

  const directorsMap = new Map();

  (idx?.Direktur || [])
    .filter((item) => isDirector(item?.posisi))
    .forEach((item) => {
      const key = normalizeName(item?.nama);

      directorsMap.set(key, {
        name: capitalizeWord(normalizeName(item?.nama)) ?? null,
        slug: getSlug(cleanDisplayName(item?.nama)),
        position: {
          en: "",
          id: capitalizeWord(item?.posisi) ?? "",
        },
        multi_language: true,
        default_language: "id",
        affiliated: item?.terafiliasi === "Ya",
      });
    });

  return [...directorsMap.values()];
};

export const getCommissioners = (idx) => {
  const normalizeName = (name = "") =>
    name
      .replace(
        /^(mr|mrs|ms|dr|prof|ir|haji|hj|h\.|hc|s\.kom|se|mba|phd)\.?/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isCommissioner = (position = "") => {
    const pos = position.toLowerCase();

    return (
      pos.includes("komisaris") ||
      pos.includes("komisaris utama") ||
      pos.includes("komisaris independen") ||
      pos.includes("wakil komisaris") ||
      pos.includes("commissioner") ||
      pos.includes("president commissioner") ||
      pos.includes("independent commissioner") ||
      pos.includes("vice commissioner")
    );
  };

  const commissionersMap = new Map();

  (idx?.Komisaris || [])
    .filter((item) => isCommissioner(item?.posisi))
    .forEach((item) => {
      const key = normalizeName(item?.nama);

      commissionersMap.set(key, {
        name: capitalizeWord(normalizeName(item?.nama)) ?? null,
        slug: getSlug(cleanDisplayName(item?.nama)),
        position: {
          en: "",
          id: capitalizeWord(item?.posisi) ?? "",
        },
        multi_language: true,
        default_language: "id",
        affiliated: item?.terafiliasi === "Ya",
      });
    });

  return [...commissionersMap.values()];
};

export const getAuditors = (idx) => {
  const normalizeName = (name = "") =>
    name
      .replace(/^(mr|mrs|ms)\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const isAuditor = (position = "") => {
    const pos = position.toLowerCase();

    return (
      pos.includes("ketua") || pos.includes("anggota") || pos.includes("audit")
    );
  };

  const auditorsMap = new Map();

  (idx?.["Komite Audit"] || [])
    .filter((item) => isAuditor(item?.posisi))
    .forEach((item) => {
      const key = normalizeName(item?.nama);

      auditorsMap.set(key, {
        name: capitalizeWord(normalizeName(item?.nama)) ?? null,
        slug: getSlug(cleanDisplayName(item?.nama)),
        position: {
          en: "",
          id: capitalizeWord(item?.posisi) ?? "",
        },
        multi_language: true,
        default_language: "id",
      });
    });

  return [...auditorsMap.values()];
};

export const getShareHolders = (idx) => {
  const typeMap = {
    "Lebih dari 5%": {
      id: "Lebih dari 5%",
      en: "More than 5%",
    },
    "Saham Treasury": {
      id: "Saham Treasury",
      en: "Treasury Shares",
    },
    "Masyarakat Warkat": {
      id: "Masyarakat Warkat",
      en: "Scrip Public",
    },
    "Masyarakat Non Warkat": {
      id: "Masyarakat Non Warkat",
      en: "Scripless Public",
    },
    Komisaris: {
      id: "Komisaris",
      en: "Commissioner",
    },
    Direksi: {
      id: "Direksi",
      en: "Director",
    },
    Afiliasi: {
      id: "Afiliasi",
      en: "Affiliated",
    },
  };

  return (idx?.["Pemegang Saham"] || [])
    .map((item) => ({
      name: item?.nama ?? null,
      slug: getSlug(cleanDisplayName(item?.nama)),
      type: typeMap[item?.tipe] || {
        id: item?.tipe ?? null,
        en: item?.tipe ?? null,
      },
      total_shares: item?.jumlah
        ? Number(String(item.jumlah).replace(/[^\d]/g, ""))
        : null,
      percentage: item?.persentase
        ? parseFloat(String(item.persentase).replace("%", ""))
        : null,
    }))
    .sort((a, b) => b.total_shares - a.total_shares);
};

export const getSubsidiaries = (idx) => {
  return (idx?.["Anak Perusahaan"] || [])
    .map((item) => ({
      name: item?.nama ?? null,
      type: {
        id:
          item?.jenis
            ?.split(/,| dan /i)
            .map((item) => capitalizeWord(item.trim())) ?? null,
        en: null,
      },
      slug: getSlug(cleanDisplayName(item?.nama)),
      total_assets: item?.["aset total"]
        ? Number(String(item["aset total"]).replace(/[^\d]/g, ""))
        : null,
      ownership_percentage: item?.persentase
        ? parseFloat(String(item.persentase).replace("%", ""))
        : null,
      multi_language: true,
      default_laguange: "id",
    }))
    .sort((a, b) => b.total_assets - a.total_assets);
};

// Global Data
const industries = readJsonDataGlobal("industries.json");
const subIndustries = readJsonDataGlobal("sub_industries.json");
const sectors = readJsonDataGlobal("sectors.json");
const subSectors = readJsonDataGlobal("sub_sectors.json");

export default async function parsing(idx = {}, options) {
  return {
    ticker: uppercaseWord(idx?.Kode),
    logo: `https://stockplan.id/images/company/${idx?.Kode}.svg`,
    name: getCompanyName(idx),
    sector: getSector(sectors, subSectors, idx?.Sektor, idx?.Subsektor),
    industry: getIndustry(
      industries,
      subIndustries,
      idx?.Industri,
      idx?.Subindustri
    ),
    tax_id: idx?.NPWP,
    fax: idx?.Fax,
    email: idx?.["Alamat Email"]
      ?.split(/[,/]/)
      ?.map((item) => item.trim())
      ?.filter(Boolean),
    website: getWebsite(idx?.Situs),
    ipo_date: idx?.["Tanggal Pencatatan"],
    office_address: getAddress(idx),
    board: getBoard(idx),
    business_field: getBusinessField(idx),
    corporate_secretary: getCorporateSecretary(idx),
    directors: getDirectors(idx),
    commissioners: getCommissioners(idx),
    audit_committee: getAuditors(idx),
    shareholders: getShareHolders(idx),
    subsidiaries: getSubsidiaries(idx),
  };
}
