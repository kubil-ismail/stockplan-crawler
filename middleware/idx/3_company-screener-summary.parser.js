import { toNumber } from "../../lib/helper.js";

const removeWord = (text = "", blacklist = []) => {
  return text
    .split(" ")
    .filter((word) => !blacklist.includes(word.toLowerCase()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const uppercaseWord = (text = "") => text.trim().toUpperCase();
const capitalizeWord = (text = "") =>
  text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

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
    shortName:
      removeWord(capitalizeWord(idx?.Nama_Perusahaan), blacklist) ?? null,
    longName: capitalizeWord(idx?.Nama_Perusahaan),
  };
};

const getIndex = (item) => {
  return uppercaseWord(item)
    .split(",")
    .map((item) => item.trim());
};

export default async function parsing(idx = {}) {
  return idx?.map((item) => {
    return {
      ticker: uppercaseWord(item?.Kode_Saham),
      name: getCompanyName(item),
      index: getIndex(item.Index),
      per: toNumber(item?.Per ?? "0"),
      pbv: toNumber(item?.Pbv ?? "0"),
      roe: toNumber(item?.Roe ?? "0"),
      roa: toNumber(item?.Roa ?? "0"),
      der: toNumber(item?.Der ?? "0"),
      npm: toNumber(item?.npm ?? "0"),
      mkt_cap: toNumber(item?.Mkt_Cap ?? "0"),
      total_revenue: toNumber(item?.Total_Rev ?? "0"),
    };
  });
}
