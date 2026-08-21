#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observe } from "../src/physics.js";
import { AphelionContract } from "../src/circuit.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEMO = {
  massSolar: 14.2,
  spin: 0.72,
  raHours: 13.418,
  decDeg: -26.107,
  distanceMpc: 11.4,
  t0: 20260817,
  instrumentClass: 2,
  minSnrBand: 1,
  epoch: 20260817,
};

function hexSecret() {
  return randomBytes(32).toString("hex");
}

export function runDemo(opts = {}) {
  const input = { ...DEMO, ...opts };
  const observerSecret = input.observerSecret || hexSecret();
  const instrumentSecret = input.instrumentSecret || hexSecret();
  const contract = new AphelionContract(input.network || "local");

  const issued = contract.issueInstrument({
    instrumentClass: input.instrumentClass,
    minSnrBand: input.minSnrBand,
    instrumentSecret,
  });

  const obs = observe(input);
  const filed = contract.fileDetection({
    instrumentClass: input.instrumentClass,
    minSnrBand: input.minSnrBand,
    epoch: input.epoch,
    observerSecret,
    skyHash: obs.skyHash,
    strainHash: obs.strainHash,
    snrMilli: obs.snrMilli,
    instrumentSecret,
  });

  const confirmed = contract.confirmDetection();

  const publicState = contract.getPublicState();
  return {
    contractId: contract.contractId,
    network: contract.network,
    observation: {
      snrBand: obs.snrBand,
      photonSphere: obs.photonSphere,
      isco: obs.isco,
    },
    issue: issued,
    file: filed,
    confirm: confirmed,
    public: publicState,
    proof: filed.proof,
    hud: publicHud(publicState),
  };
}

/** Public first-screen numbers only — no RA/Dec, no milli-SNR, no secrets. */
export function publicHud(publicState) {
  return {
    snrBand: publicState.snrBand,
    status: publicState.status,
    detectionCount: publicState.detectionCount,
    instrumentClass: publicState.instrumentClass,
    epoch: publicState.epoch,
  };
}

export function writePublicLedger(publicState, dest) {
  const payload = publicHud(publicState);
  const text = JSON.stringify(payload, null, 2) + "\n";
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
  return payload;
}

const cmd = process.argv[2] || "demo";
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("aphelion.js")) {
  if (cmd === "demo") {
    const out = runDemo();
    const ledgerPath = path.join(ROOT, "artifacts", "public-ledger.json");
    writePublicLedger(out.public, ledgerPath);
    process.stdout.write(
      `APHELION HUD  SNR band ${out.hud.snrBand}  status ${out.hud.status}  detections ${out.hud.detectionCount}\n`,
    );
    process.stdout.write(JSON.stringify({ hud: out.hud, public: out.public, proof: out.proof }, null, 2) + "\n");
    if (!out.contractId || !out.public.nullifier || out.proof.accepted !== true) {
      process.exit(2);
    }
    if (!(out.hud.snrBand > 0) || out.hud.detectionCount < 1) {
      process.exit(3);
    }
  } else {
    process.stderr.write("usage: node cli/aphelion.js demo\n");
    process.exit(1);
  }
}
