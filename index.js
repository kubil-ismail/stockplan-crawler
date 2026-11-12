// Proses crawler yang selalu hidup: job dari "Jalankan sekarang" / "Coba lagi" di AdminSinkron
// langsung diambil dan di-scrape. Menu manual tetap lewat `npm run build`.
import { startAgent } from "./lib/sync-agent.js";

await startAgent();
