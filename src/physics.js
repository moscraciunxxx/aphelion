import { sha256, hex32 } from "./hash.js";

export const SAMPLE_COUNT = 128;

/** SNR band floors in milli-SNR (Compact `minSnrForBand`). */
export const SNR_BAND_FLOORS = Object.freeze({
  0: 500,
  1: 800,
  2: 1200,
  3: 2000,
});

export function minSnrForBand(band) {
  const b = Number(band);
  if (b <= 0) return SNR_BAND_FLOORS[0];
  if (b === 1) return SNR_BAND_FLOORS[1];
  if (b === 2) return SNR_BAND_FLOORS[2];
  return SNR_BAND_FLOORS[3];
}

export function snrToBand(snrMilli) {
  const s = Number(snrMilli);
  if (s >= SNR_BAND_FLOORS[3]) return 3;
  if (s >= SNR_BAND_FLOORS[2]) return 2;
  if (s >= SNR_BAND_FLOORS[1]) return 1;
  if (s >= SNR_BAND_FLOORS[0]) return 0;
  return -1;
}

/**
 * Newtonian chirp + thin-disk photometry used as the private observation.
 * Coordinates and the raw strain never leave this module except as hashes.
 */
export function observe(input) {
  const massSolar = Number(input.massSolar);
  const spin = clamp(Number(input.spin), 0, 0.998);
  const raHours = Number(input.raHours);
  const decDeg = Number(input.decDeg);
  const distanceMpc = Math.max(Number(input.distanceMpc), 0.01);
  const t0 = Number(input.t0 ?? 0);

  if (!Number.isFinite(massSolar) || massSolar <= 0) {
    throw new Error("massSolar must be positive");
  }
  if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) {
    throw new Error("sky coordinates required");
  }

  const rs = 2 * massSolar;
  const isco = (6 - 2 * spin) * massSolar;
  const samples = new Float64Array(SAMPLE_COUNT);
  let energy = 0;
  let noise = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const tau = (i + 0.5) / SAMPLE_COUNT;
    const freq = 40 + (180 * massSolar) / (10 + massSolar) * tau * tau;
    const envelope = Math.exp(-3.2 * (1 - tau) * (1 - tau)) * (0.35 + 0.65 * tau);
    const phase = 2 * Math.PI * freq * tau + t0 * 0.017;
    const beaming = 1 + 0.55 * spin * Math.sin(phase);
    const disk = Math.pow(isco / (isco + 8 * tau * rs), 0.75);
    const geometric = 1 / (distanceMpc * distanceMpc);
    const pointing = 0.65 + 0.35 * Math.cos((raHours / 12) * Math.PI) * Math.cos((decDeg * Math.PI) / 180);
    const signal = 1.05e6 * envelope * beaming * disk * geometric * pointing;
    const jitter = 18 + 7 * Math.abs(Math.sin(i * 12.9898 + t0));
    samples[i] = signal + jitter;
    energy += signal * signal;
    noise += jitter * jitter;
  }

  const snr = Math.sqrt(energy / Math.max(noise, 1e-9));
  const snrMilli = Math.max(0, Math.round(snr * 100));
  const skyHash = sha256(Buffer.from(`${raHours.toFixed(6)},${decDeg.toFixed(6)}`, "utf8"));
  const strainHash = sha256(Buffer.from(samples.buffer));
  const peak = Math.max(...samples);

  return {
    samples: Array.from(samples),
    snr,
    snrMilli,
    snrBand: snrToBand(snrMilli),
    peak,
    skyHash: hex32(skyHash),
    strainHash: hex32(strainHash),
    isco,
    photonSphere: 1.5 * rs,
    massSolar,
    spin,
    distanceMpc,
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
