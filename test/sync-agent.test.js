import { test } from "node:test";
import assert from "node:assert/strict";
import { runJob } from "../lib/sync-agent.js";

test("job tanpa crawler dilaporkan gagal", async () => {
  const r = await runJob({ key: "kip", tickers: null });
  assert.equal(r.failures.length, 1);
  assert.equal(r.ok, null);
});

test("prof/sub/mgmt memakai satu run crawler detail", async () => {
  let calls = 0;
  const runners = {
    detail: async (o) => {
      calls++;
      assert.deepEqual(o, { force: true, tickers: ["BUMI"] });
      return { ok: 0, total: 1, failures: [{ ticker: "BUMI", message: "x".repeat(300) }] };
    },
  };
  const cache = new Map();
  const a = await runJob({ key: "prof", tickers: ["BUMI"] }, cache, runners);
  const b = await runJob({ key: "mgmt", tickers: ["BUMI"] }, cache, runners);
  assert.equal(calls, 1);
  assert.deepEqual(b.tickers, ["BUMI"]);
  assert.equal(a.failures[0].message.length, 200);
});

test("crawler satu halaman: total dari output, error jadi failure", async () => {
  const ok = await runJob({ key: "idx", tickers: null }, new Map(), { screener: async () => ({ total: 958, data: [] }) });
  assert.equal(ok.ok, 958);
  assert.equal(ok.total, 958);
  assert.equal(ok.tickers, null);

  const bad = await runJob({ key: "idx", tickers: null }, new Map(), { screener: async () => { throw new Error("Blocked by Cloudflare"); } });
  assert.equal(bad.failures[0].message, "Blocked by Cloudflare");
  assert.ok(bad.finishedAt >= bad.startedAt);
});

test("diblokir IDX: job berikutnya di putaran yang sama tidak menjalankan crawler", async () => {
  let calls = 0;
  const runners = {
    detail: async () => { calls++; const e = new Error("Diblokir IDX (Cloudflare WAF)."); e.hardBlock = true; throw e; },
    history: async () => { calls++; return { ok: 1, total: 1, failures: [] }; },
  };
  const cache = new Map();
  const a = await runJob({ key: "prof", tickers: null }, cache, runners);
  const b = await runJob({ key: "px", tickers: ["BUMI"] }, cache, runners);
  assert.equal(calls, 1);
  assert.equal(a.blocked, undefined);
  assert.match(b.failures[0].message, /Diblokir IDX/);
  assert.deepEqual(b.tickers, ["BUMI"]);
  assert.equal(b.ok, null);
});
