// Satu-satunya tempat Chromium dibuat: playwright-extra + plugin stealth, didaftarkan sekali per proses.
// Stealth tidak menembus blokir WAF ("Sorry, you have been blocked"); itu tetap ditangani assertNotHardBlocked.
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

chromium.use(stealth());

export { chromium };
