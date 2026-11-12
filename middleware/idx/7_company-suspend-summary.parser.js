import { compareDesc, parse } from "date-fns";

import { format, isValid } from "date-fns";
import { id } from "date-fns/locale";

const sortByLatest = (data = []) =>
  data.sort((a, b) =>
    compareDesc(
      parse(a.tanggal, "yyyy-MM-dd", new Date(), { locale: id }),
      parse(b.tanggal, "yyyy-MM-dd", new Date(), { locale: id })
    )
  );

const extractTickers = (text) => {
  const matches = text.match(/\(([A-Z]{4,5})\)/g) || [];

  return matches
    .map((m) => m.replace(/[()]/g, ""))
    .filter((ticker) => ticker !== "KODE"); // buang (>1 Kode)
};

const getStatus = (text) => {
  const lower = text.toLowerCase();

  if (
    lower.includes("pembukaan penghentian sementara") ||
    lower.includes("pembukaan kembali perdagangan") ||
    lower.includes("unsuspensi")
  ) {
    return "ACTIVE";
  }

  if (
    lower.includes("penghentian sementara perdagangan") ||
    lower.includes("penghentian sementara saham") ||
    lower.includes("suspensi")
  ) {
    return "SUSPEND";
  }

  return null;
};

const buildSuspendStatus = (rows = []) => {
  const statusMap = new Map();

  // proses kronologis
  const sorted = [...rows].reverse();

  for (const row of sorted) {
    const status = getStatus(row.suspensi);

    if (!status) continue;

    const tickers = extractTickers(row.suspensi);

    for (const ticker of tickers) {
       const parsed_date = parse(row.tanggal.trim(), "dd MMM yyyy", new Date(), {
         locale: id,
       });


      statusMap.set(ticker, {
        ticker,
        status,
        tanggal: isValid(parsed_date)
          ? format(parsed_date, "yyyy-MM-dd")
          : null,
        judul: row.suspensi,
        file: row.file,
      });
    }
  }

  return {
    all: [...statusMap.values()],
    suspended: [...statusMap.values()].filter(
      (item) => item.status === "SUSPEND"
    ),
  };
};

export default async function parsing(data = []) {
  const { all, suspended } = buildSuspendStatus(data ?? []);

  return {
    all: sortByLatest(all),
    suspended: sortByLatest(suspended),
  };
}
