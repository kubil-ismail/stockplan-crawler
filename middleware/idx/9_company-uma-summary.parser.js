import { compareDesc, format, isValid, parse } from "date-fns";
import { id } from "date-fns/locale";

const sortByLatest = (data = []) =>
  data.sort((a, b) =>
    compareDesc(
      parse(a.tanggal, "yyyy-MM-dd", new Date(), { locale: id }),
      parse(b.tanggal, "yyyy-MM-dd", new Date(), { locale: id })
    )
  );

const extractTickers = (text = "") => {
  const matches = text.match(/\(([^)]+)\)/g) || [];

  return [
    ...new Set(
      matches
        .flatMap((match) =>
          match
            .slice(1, -1)
            .split(",")
            .map((ticker) => ticker.trim().toUpperCase())
        )
        .filter(
          (ticker) =>
            ticker &&
            ticker !== "KODE" &&
            /^[A-Z0-9]+(?:-[A-Z0-9]+)?$/.test(ticker)
        )
    ),
  ];
};

const buildUma = (rows = []) => {
  const statusMap = new Map();

  // proses kronologis
  const sorted = [...rows].reverse();

  for (const row of sorted) {
    const tickers = extractTickers(row.uma);

    for (const ticker of tickers) {
      const parsed_date = parse(row.tanggal.trim(), "dd MMM yyyy", new Date(), {
        locale: id,
      });

      statusMap.set(ticker, {
        ticker,
        tanggal: isValid(parsed_date)
          ? format(parsed_date, "yyyy-MM-dd")
          : null,
        judul: row.uma,
        file: row.file,
      });
    }
  }

  return {
    all: [...statusMap.values()],
  };
};

export default async function parsing(data = []) {
  const { all } = buildUma(data ?? []);

  return {
    all: sortByLatest(all),
  };
}
