#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { observe } from "../src/physics.js";
import { AphelionContract } from "../src/circuit.js";

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

  return {
    contractId: contract.contractId,
    network: contract.network,
    observation: {
      snr: obs.snr,
      snrMilli: obs.snrMilli,
      snrBand: obs.snrBand,
      photonSphere: obs.photonSphere,
      isco: obs.isco,
    },
    issue: issued,
    file: filed,
    confirm: confirmed,
    public: contract.getPublicState(),
    proof: filed.proof,
  };
}

const cmd = process.argv[2] || "demo";
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("aphelion.js")) {
  if (cmd === "demo") {
    const out = runDemo();
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    if (!out.contractId || !out.public.nullifier || out.proof.accepted !== true) {
      process.exit(2);
    }
  } else {
    process.stderr.write("usage: node cli/aphelion.js demo\n");
    process.exit(1);
  }
}
