import { createHash } from "node:crypto";

/** Domain-pad a UTF-8 string to 32 bytes (Compact `pad(32, s)`). */
export function pad32(s) {
  const out = Buffer.alloc(32);
  Buffer.from(String(s), "utf8").copy(out, 0, 0, 32);
  return out;
}

/** Encode an unsigned integer as a 32-byte big-endian field (Compact `n as Field as Bytes<32>`). */
export function uintToBytes32(n) {
  const out = Buffer.alloc(32);
  const hex = BigInt(n).toString(16).padStart(64, "0").slice(-64);
  Buffer.from(hex, "hex").copy(out);
  return out;
}

/**
 * Local binding of Compact `persistentHash`. Midnight's compiled circuits use
 * the field hash inside the proof system; this SHA-256 domain hash is the
 * function the Node backend and tests actually call when compact-runtime
 * proofs are not available.
 */
export function persistentHash(parts) {
  const h = createHash("sha256");
  for (const part of parts) {
    if (!Buffer.isBuffer(part) || part.length !== 32) {
      throw new Error("persistentHash expects 32-byte buffers");
    }
    h.update(part);
  }
  return h.digest();
}

export function hex32(buf) {
  return Buffer.from(buf).toString("hex");
}

export function fromHex32(hex) {
  const clean = String(hex).replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("expected 32-byte hex");
  }
  return Buffer.from(clean, "hex");
}

export function sha256(data) {
  return createHash("sha256").update(data).digest();
}
