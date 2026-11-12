// npm run push [-- BBCA BUMI]: kirim file minify yang sudah ada di dist ke backend, tanpa scraping.
import { pushCompanies } from "./push.js";

const tickers = process.argv.slice(2).map((t) => t.toUpperCase());

try {
  const { failures } = await pushCompanies({ tickers: tickers.length ? tickers : null });
  for (const f of failures) console.log(`❌ ${f.ticker}: ${f.message} (${f.log})`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
