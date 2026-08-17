import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Compact compiler left the three exported proof circuits on disk", () => {
  const info = JSON.parse(
    fs.readFileSync(path.join(root, "contract/managed/aphelion/compiler/contract-info.json"), "utf8"),
  );
  const names = info.circuits.map((c) => c.name);
  for (const need of ["issueInstrument", "fileDetection", "confirmDetection"]) {
    assert.ok(names.includes(need), need);
    const zkir = path.join(root, "contract/managed/aphelion/zkir", `${need}.zkir`);
    assert.ok(fs.existsSync(zkir), zkir);
    assert.ok(fs.statSync(zkir).size > 20);
  }
  assert.ok(fs.existsSync(path.join(root, "public/index.html")));
  assert.ok(fs.existsSync(path.join(root, "public/horizon.js")));
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  assert.doesNotMatch(html, /\brequire\s*\(/);
  assert.doesNotMatch(html, /\bmodule\.exports\b/);
});
