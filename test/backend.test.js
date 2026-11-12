import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { postCompanies, getQueue, RETRY_DELAY_MS } from "../lib/backend.js";

const TOKEN = "rahasia-".repeat(5);
const realFetch = globalThis.fetch;
let calls;

function fakeFetch(responses) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length, responses.length) - 1];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  };
}

beforeEach(() => {
  process.env.BACKEND_URL = "http://backend.test/";
  process.env.SYNC_TOKEN = TOKEN;
  RETRY_DELAY_MS.value = 1;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("kirim token & body ke path yang benar", async () => {
  fakeFetch([{ status: 200, body: { updated: 1 } }]);
  assert.deepEqual(await postCompanies([{ ticker: "AADI" }]), { updated: 1 });
  assert.equal(calls[0].url, "http://backend.test/admin/api/sync/agent/companies");
  assert.equal(calls[0].init.headers.authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { data: [{ ticker: "AADI" }] });
});

test("5xx dan error jaringan di-retry sampai 3x", async () => {
  fakeFetch([{ status: 503 }, new TypeError("fetch failed"), { status: 200, body: { jobs: [] } }]);
  assert.deepEqual(await getQueue(), { jobs: [] });
  assert.equal(calls.length, 3);

  fakeFetch([{ status: 500 }]);
  await assert.rejects(getQueue(), /→ 500/);
  assert.equal(calls.length, 3);
});

test("4xx langsung gagal tanpa retry, token tidak ada di pesan error", async () => {
  fakeFetch([{ status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Token sinkron salah." } } }]);
  const err = await getQueue().catch((e) => e);
  assert.equal(calls.length, 1);
  assert.equal(err.status, 401);
  assert.match(err.message, /UNAUTHENTICATED/);
  assert.equal(err.message.includes(TOKEN), false);
});

test("env kosong: pesan jelas", async () => {
  delete process.env.SYNC_TOKEN;
  await assert.rejects(getQueue(), /BACKEND_URL dan SYNC_TOKEN/);
});
