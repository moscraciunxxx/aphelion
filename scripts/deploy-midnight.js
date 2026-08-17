#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AphelionContract } from "../src/circuit.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = [];
function log(s) {
  lines.push(s);
  process.stdout.write(s + "\n");
}

const compact = `${process.env.HOME}/.local/bin/compact`;
log(`compact-bin: ${compact}`);
log(`compact-exists: ${fs.existsSync(compact)}`);

const ver = spawnSync(compact, ["compile", "--", "--version"], { encoding: "utf8" });
log(`compact-compiler: ${(ver.stdout || ver.stderr || "").trim()}`);

const src = path.join(root, "contract", "aphelion.compact");
const out = path.join(root, "contract", "managed", "aphelion");
fs.mkdirSync(out, { recursive: true });
const compiled = spawnSync(compact, ["compile", "--", "--skip-zk", src, out], { encoding: "utf8" });
log(`compile-status: ${compiled.status}`);
log((compiled.stdout || "").trim());
log((compiled.stderr || "").trim());

const docker = spawnSync("sh", ["-c", "command -v docker; docker --version"], { encoding: "utf8" });
log(`docker: ${(docker.stdout || docker.stderr || "not found").trim()}`);

const endpoints = [
  ["preview-indexer", "https://indexer.preview.midnight.network/ready"],
  ["preprod-indexer", "https://indexer.preprod.midnight.network/ready"],
  ["preview-faucet", "https://midnight-tmnight-preview.nethermind.dev/"],
  ["preprod-faucet", "https://midnight-tmnight-preprod.nethermind.dev/"],
];

for (const [name, url] of endpoints) {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    log(`${name}: HTTP ${res.status} ${text.slice(0, 180).replace(/\s+/g, " ")}`);
  } catch (err) {
    log(`${name}: FAIL ${err.message}`);
  }
}

const proof = spawnSync("sh", ["-c", "curl -fsS --max-time 2 http://127.0.0.1:6300/health || true"], {
  encoding: "utf8",
});
log(`proof-server: ${(proof.stdout || proof.stderr || "down").trim() || "down"}`);

const local = new AphelionContract("local");
log(`local-contract-id: ${local.contractId}`);
log(`network-claimed: none — Preview/PreProd deploy did not run`);
log(`reason: Compact compiler is present; Docker proof-server and funded wallet are required to submit a tx. This script does not invent an address.`);

const dest = process.env.APHELION_DEPLOY_LOG;
if (dest) fs.writeFileSync(dest, lines.join("\n") + "\n");
