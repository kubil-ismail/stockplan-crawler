import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { pushCompanies } from "../lib/push.js";

function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-"));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test("kirim apa adanya per 50, hitung status, file rusak & invalid jadi failure", async () => {
  const files = { "RUSK.json": "{bukan json" };
  for (let i = 0; i < 60; i++) {
    const t = `T${String(i).padStart(3, "0")}`;
    files[`${t}.json`] = JSON.stringify({ total: 1, data: { ticker: t, board: { name: "Utama" } } });
  }
  const dir = tmpDir(files);
  const batches = [];
  const post = async (items) => {
    batches.push(items.length);
    assert.deepEqual(items[0].board, { name: "Utama" }); // isi data dikirim tanpa diubah
    const results = items.map((d) => ({ ticker: d.ticker, status: d.ticker === "T001" ? "invalid" : "updated", errors: { x: "y" } }));
    return { updated: results.filter((r) => r.status === "updated").length, invalid: 1 * results.some((r) => r.status === "invalid"), results };
  };

  const r = await pushCompanies({ dir, post, log: () => {} });
  assert.deepEqual(batches, [50, 10]);
  assert.equal(r.counts.updated, 59);
  assert.equal(r.counts.invalid, 1);
  assert.deepEqual(r.invalid, ["T001"]);
  assert.deepEqual(r.failures.map((f) => f.ticker).sort(), ["RUSK", "T001"]);
});

test("tickers: hanya file itu; file tidak ada jadi failure", async () => {
  const dir = tmpDir({ "AADI.json": JSON.stringify({ data: { ticker: "AADI" } }) });
  const sent = [];
  const r = await pushCompanies({ dir, tickers: ["AADI", "NONE"], post: async (items) => (sent.push(...items), { results: [] }), log: () => {} });
  assert.deepEqual(sent.map((d) => d.ticker), ["AADI"]);
  assert.deepEqual(r.failures.map((f) => f.ticker), ["NONE"]);
});
