import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { observe } from "../src/physics.js";
import {
  AphelionContract,
  compactCircuits,
} from "../src/circuit.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPACT = path.readFile
  ? null
  : path.join(ROOT, "contract", "aphelion.compact");

function secret() {
  return randomBytes(32).toString("hex");
}

function closeDetection(over = {}) {
  return {
    massSolar: 14.2,
    spin: 0.72,
    raHours: 13.418,
    decDeg: -26.107,
    distanceMpc: 11.4,
    t0: 17,
    ...over,
  };
}

test("compact source exports the circuits the backend names", () => {
  const src = fs.readFileSync(path.join(ROOT, "contract", "aphelion.compact"), "utf8");
  for (const name of compactCircuits) {
    assert.match(src, new RegExp(`circuit\\s+${name}\\s*\\(`));
  }
  assert.match(src, /witness\s+observerSecret/);
  assert.match(src, /witness\s+skyHash/);
  assert.match(src, /witness\s+strainHash/);
  assert.match(src, /witness\s+snrMilli/);
  assert.match(src, /witness\s+instrumentSecret/);
  assert.doesNotMatch(src, /example-bboard|bboard:pk:/);
});

test("valid witness files a detection and discloses only the public band", () => {
  const instrumentSecret = secret();
  const observerSecret = secret();
  const contract = new AphelionContract("test");
  const issued = contract.issueInstrument({
    instrumentClass: 2,
    minSnrBand: 1,
    instrumentSecret,
  });
  const obs = observe(closeDetection());
  assert.ok(obs.snrMilli >= 800, "fixture must clear band 1 so the circuit is the thing under test");
  const filed = contract.fileDetection({
    instrumentClass: 2,
    minSnrBand: 1,
    epoch: 20260817,
    observerSecret,
    skyHash: obs.skyHash,
    strainHash: obs.strainHash,
    snrMilli: obs.snrMilli,
    instrumentSecret,
  });

  assert.equal(filed.ok, true);
  assert.equal(filed.contractId, contract.contractId);
  assert.equal(filed.public.status, "OPEN");
  assert.equal(filed.public.instrumentClass, 2);
  assert.equal(filed.public.snrBand, 1);
  assert.equal(filed.public.epoch, 20260817);
  assert.equal(filed.public.detectionCount, 1);
  assert.equal(filed.public.nullifier.length, 64);
  assert.notEqual(filed.public.nullifier, observerSecret);
  assert.notEqual(filed.public.nullifier, instrumentSecret);
  assert.equal(filed.proof.accepted, true);
  assert.equal(filed.proof.circuit, "fileDetection");
  assert.equal(issued.public.attestationRoot, filed.public.attestationRoot);

  const dumped = JSON.stringify(filed);
  assert.equal(dumped.includes(observerSecret), false);
  assert.equal(dumped.includes(instrumentSecret), false);
  assert.equal(dumped.includes("13.418"), false);
  assert.equal(dumped.includes("-26.107"), false);
  assert.equal(Object.hasOwn(filed.public, "skyHash"), false);
  assert.equal(Object.hasOwn(filed.public, "strainHash"), false);
  assert.equal(Object.hasOwn(filed.public, "snrMilli"), false);
  assert.equal(Object.hasOwn(filed.public, "samples"), false);
  assert.equal(Object.hasOwn(filed.public, "raHours"), false);
});

test("SNR below the accredited floor is rejected", () => {
  const instrumentSecret = secret();
  const contract = new AphelionContract("test");
  contract.issueInstrument({ instrumentClass: 2, minSnrBand: 1, instrumentSecret });
  const obs = observe(closeDetection({ distanceMpc: 90 }));
  assert.ok(obs.snrMilli < 800, "far fixture must sit under the floor");
  assert.throws(
    () =>
      contract.fileDetection({
        instrumentClass: 2,
        minSnrBand: 1,
        epoch: 20260817,
        observerSecret: secret(),
        skyHash: obs.skyHash,
        strainHash: obs.strainHash,
        snrMilli: obs.snrMilli,
        instrumentSecret,
      }),
    /SNR below accredited threshold/,
  );
  assert.equal(contract.getPublicState().status, "EMPTY");
  assert.equal(contract.getPublicState().detectionCount, 0);
});

test("wrong instrument secret cannot file", () => {
  const contract = new AphelionContract("test");
  contract.issueInstrument({
    instrumentClass: 2,
    minSnrBand: 1,
    instrumentSecret: secret(),
  });
  const obs = observe(closeDetection());
  assert.throws(
    () =>
      contract.fileDetection({
        instrumentClass: 2,
        minSnrBand: 1,
        epoch: 20260817,
        observerSecret: secret(),
        skyHash: obs.skyHash,
        strainHash: obs.strainHash,
        snrMilli: obs.snrMilli,
        instrumentSecret: secret(),
      }),
    /instrument not accredited/,
  );
});

test("zero sky or strain hashes are rejected as empty observations", () => {
  const instrumentSecret = secret();
  const contract = new AphelionContract("test");
  contract.issueInstrument({ instrumentClass: 2, minSnrBand: 1, instrumentSecret });
  const obs = observe(closeDetection());
  const zeros = "0".repeat(64);
  assert.throws(
    () =>
      contract.fileDetection({
        instrumentClass: 2,
        minSnrBand: 1,
        epoch: 20260817,
        observerSecret: secret(),
        skyHash: zeros,
        strainHash: obs.strainHash,
        snrMilli: obs.snrMilli,
        instrumentSecret,
      }),
    /empty observation/,
  );
  assert.throws(
    () =>
      contract.fileDetection({
        instrumentClass: 2,
        minSnrBand: 1,
        epoch: 20260817,
        observerSecret: secret(),
        skyHash: obs.skyHash,
        strainHash: zeros,
        snrMilli: obs.snrMilli,
        instrumentSecret,
      }),
    /empty observation/,
  );
});

test("nullifier cannot be spent twice", () => {
  const instrumentSecret = secret();
  const observerSecret = secret();
  const contract = new AphelionContract("test");
  contract.issueInstrument({ instrumentClass: 2, minSnrBand: 1, instrumentSecret });
  const obs = observe(closeDetection());
  const args = {
    instrumentClass: 2,
    minSnrBand: 1,
    epoch: 20260817,
    observerSecret,
    skyHash: obs.skyHash,
    strainHash: obs.strainHash,
    snrMilli: obs.snrMilli,
    instrumentSecret,
  };
  contract.fileDetection(args);
  assert.throws(() => contract.fileDetection(args), /observation already filed/);
});

void COMPACT;
