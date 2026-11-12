const parseNotation = (row) => {
  const [ticker] = row.kode.split(".");

  const descriptions = (row.keterangan ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [code, ...desc] = item.split(":");

      return {
        code: code.trim(),
        description: desc.join(":").trim(),
      };
    });

  return {
    ticker,
    company_name: row.nama,
    notations: descriptions,
  };
};

export default function parsing(idx = []) {
  return (idx ?? [])
    .map(parseNotation)
    .filter((item) => item.ticker.length === 4);
}
