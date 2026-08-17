import { AphelionContract } from "./circuit.js";

let instance = null;

export function getContract(network = process.env.APHELION_NETWORK || "local") {
  if (!instance || instance.network !== network) {
    instance = new AphelionContract(network);
  }
  return instance;
}

export function resetContract(network = process.env.APHELION_NETWORK || "local") {
  instance = new AphelionContract(network);
  return instance;
}
