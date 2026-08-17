#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "contract", "aphelion.compact");
const out = path.join(root, "contract", "managed", "aphelion");
fs.mkdirSync(out, { recursive: true });

const compact = process.env.COMPACT || `${process.env.HOME}/.local/bin/compact`;
const skipZk = process.argv.includes("--skip-zk") || process.env.APHELION_SKIP_ZK === "1";
const args = ["compile"];
if (skipZk) args.push("--", "--skip-zk", src, out);
else args.push(src, out);

const r = spawnSync(compact, args, { encoding: "utf8" });
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) process.exit(r.status || 1);
process.stdout.write(`compiled ${src} -> ${out}\n`);
