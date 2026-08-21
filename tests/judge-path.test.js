import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runDemo, publicHud, writePublicLedger } from "../cli/aphelion.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function gateB(text) {
  const out = {};
  for (const n of [1, 2, 3, 4]) {
    const m = text.match(new RegExp(String.raw`${n}\.\s+[^:\n]+:\s*(.+)`));
    out[n] = (m && m[1] ? m[1].trim() : "");
  }
  return out;
}

test("JUDGE_PATH Gate B four lines are filled and Judge URL is not localhost", () => {
  const text = fs.readFileSync(path.join(ROOT, "JUDGE_PATH.md"), "utf8");
  const b = gateB(text);
  for (const n of [1, 2, 3, 4]) {
    assert.ok(b[n].length > 8, `Gate B line ${n} empty`);
  }
  const localUrl = /https?:\/\/(?:127\.0\.0\.1|localhost)\b/i;
  assert.doesNotMatch(b[1], localUrl);
  assert.match(b[1], /https:\/\/github\.com\/moscraciunxxx\/aphelion/);
  const pack = fs.readFileSync(path.join(ROOT, "docs", "SUBMISSION.md"), "utf8");
  assert.match(pack, /\*\*Website/);
  const web = pack.match(/\*\*Website[^\n]*/);
  assert.ok(web);
  assert.doesNotMatch(web[0], localUrl);
});

test("shipped demo path writes a non-zero public SNR band without sky witnesses", () => {
  const out = runDemo();
  assert.equal(out.proof.accepted, true);
  assert.ok(out.hud.snrBand > 0, "snrBand must be a first-screen number");
  assert.ok(out.hud.detectionCount >= 1);
  assert.equal(out.hud.status, "CONFIRMED");
  const dest = path.join(ROOT, "artifacts", "public-ledger.json");
  writePublicLedger(out.public, dest);
  const ledger = JSON.parse(fs.readFileSync(dest, "utf8"));
  assert.equal(ledger.snrBand, out.hud.snrBand);
  const dumped = JSON.stringify(ledger);
  assert.equal(dumped.includes("13.418"), false);
  assert.equal(dumped.includes("-26.107"), false);
  assert.equal(Object.hasOwn(ledger, "raHours"), false);
  assert.equal(Object.hasOwn(ledger, "snrMilli"), false);
  const hud = publicHud(out.public);
  assert.equal(hud.snrBand, ledger.snrBand);
});