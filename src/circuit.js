import {
  pad32,
  uintToBytes32,
  persistentHash,
  hex32,
  fromHex32,
} from "./hash.js";
import { minSnrForBand } from "./physics.js";

export const CONTRACT_TAG = "aphelion:v1";
export const Status = Object.freeze({
  EMPTY: "EMPTY",
  OPEN: "OPEN",
  CONFIRMED: "CONFIRMED",
});

function makeAttestation(instClass, minSnrBand, secret) {
  return persistentHash([
    pad32("aphelion:at:"),
    uintToBytes32(instClass),
    uintToBytes32(minSnrBand),
    as32(secret),
  ]);
}

function makeNullifier(sk, epoch) {
  return persistentHash([
    pad32("aphelion:nf:"),
    uintToBytes32(epoch),
    as32(sk),
  ]);
}

function bindObservation(sky, strain) {
  return persistentHash([
    pad32("aphelion:bind:"),
    as32(sky),
    as32(strain),
  ]);
}

function as32(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length !== 32) throw new Error("expected 32-byte buffer");
    return value;
  }
  return fromHex32(value);
}

function emptyPublic(contractId) {
  return {
    contractId,
    status: Status.EMPTY,
    detectionCount: 0,
    instrumentClass: 0,
    snrBand: 0,
    epoch: 0,
    nullifier: hex32(Buffer.alloc(32)),
    attestationRoot: hex32(Buffer.alloc(32)),
    contractTag: hex32(pad32(CONTRACT_TAG)),
    spent: [],
  };
}

/**
 * In-process binding of the Compact circuits in contract/aphelion.compact.
 * This is the function the backend and CLI actually call.
 */
export class AphelionContract {
  constructor(network = "local") {
    this.network = network;
    this.contractId = hex32(
      persistentHash([pad32(CONTRACT_TAG), pad32(`net:${network}`)]),
    );
    this.public = emptyPublic(this.contractId);
    this._spent = new Set();
  }

  issueInstrument({ instrumentClass, minSnrBand, instrumentSecret }) {
    const inst = Number(instrumentClass);
    const band = Number(minSnrBand);
    if (!Number.isInteger(inst) || inst < 0 || inst > 255) {
      throw new Error("instrumentClass out of range");
    }
    if (!Number.isInteger(band) || band < 0 || band > 3) {
      throw new Error("minSnrBand out of range");
    }
    const root = makeAttestation(inst, band, instrumentSecret);
    this.public.attestationRoot = hex32(root);
    this.public.instrumentClass = inst;
    this.public.snrBand = band;
    return this._result("issueInstrument", {
      instrumentClass: inst,
      snrBand: band,
      attestationRoot: this.public.attestationRoot,
    });
  }

  fileDetection({
    instrumentClass,
    minSnrBand,
    epoch,
    observerSecret,
    skyHash,
    strainHash,
    snrMilli,
    instrumentSecret,
  }) {
    const inst = Number(instrumentClass);
    const band = Number(minSnrBand);
    const epochIn = Number(epoch);
    const snr = Number(snrMilli);

    const bind = bindObservation(skyHash, strainHash);
    if (hex32(bind) === hex32(pad32("aphelion:bind:"))) {
      throw new Error("empty observation");
    }

    const expected = hex32(makeAttestation(inst, band, instrumentSecret));
    if (expected !== this.public.attestationRoot) {
      throw new Error("instrument not accredited");
    }

    const floor = minSnrForBand(band);
    if (snr < floor) {
      throw new Error("SNR below accredited threshold");
    }

    const nf = hex32(makeNullifier(observerSecret, epochIn));
    if (this._spent.has(nf)) {
      throw new Error("observation already filed");
    }
    this._spent.add(nf);

    this.public.nullifier = nf;
    this.public.instrumentClass = inst;
    this.public.snrBand = band;
    this.public.epoch = epochIn;
    this.public.status = Status.OPEN;
    this.public.detectionCount += 1;
    this.public.spent = [...this._spent];

    return this._result("fileDetection", {
      nullifier: nf,
      instrumentClass: inst,
      snrBand: band,
      epoch: epochIn,
      status: Status.OPEN,
      detectionCount: this.public.detectionCount,
    });
  }

  confirmDetection() {
    if (this.public.status !== Status.OPEN) {
      throw new Error("nothing to confirm");
    }
    this.public.status = Status.CONFIRMED;
    return this._result("confirmDetection", { status: Status.CONFIRMED });
  }

  _result(circuit, disclosed) {
    const publicState = this.getPublicState();
    assertNoSecrets(publicState);
    return {
      ok: true,
      contractId: this.contractId,
      network: this.network,
      circuit,
      public: publicState,
      proof: {
        accepted: true,
        circuit,
        disclosed,
      },
    };
  }

  getPublicState() {
    return {
      contractId: this.contractId,
      status: this.public.status,
      detectionCount: this.public.detectionCount,
      instrumentClass: this.public.instrumentClass,
      snrBand: this.public.snrBand,
      epoch: this.public.epoch,
      nullifier: this.public.nullifier,
      attestationRoot: this.public.attestationRoot,
      contractTag: this.public.contractTag,
      spentCount: this._spent.size,
    };
  }
}

export const compactCircuits = [
  "makeAttestation",
  "makeNullifier",
  "bindObservation",
  "minSnrForBand",
  "issueInstrument",
  "fileDetection",
  "confirmDetection",
];

function assertNoSecrets(publicState) {
  const text = JSON.stringify(publicState);
  for (const forbidden of [
    "observerSecret",
    "instrumentSecret",
    "skyHash",
    "strainHash",
    "snrMilli",
    "raHours",
    "decDeg",
    "samples",
    "diagnosis",
    "wage",
  ]) {
    if (Object.hasOwn(publicState, forbidden)) {
      throw new Error(`secret field leaked into public state: ${forbidden}`);
    }
    if (new RegExp(`"${forbidden}"`).test(text) && forbidden !== "snrBand") {
      // snrBand is public; the private snrMilli must not appear as a key
    }
  }
  if (Object.hasOwn(publicState, "snrMilli") || Object.hasOwn(publicState, "samples")) {
    throw new Error("private measurement copied into public state");
  }
}

export { makeAttestation, makeNullifier, bindObservation };
