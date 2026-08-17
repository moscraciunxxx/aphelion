# Devpost pack — APHELION — Brainwave 2026 Midnight Track

**Project name:** APHELION  
**Tagline:** Prove the detection. Keep the sky.  
**Built with:** Midnight, Compact, Node.js, WebGL2, zero-knowledge proofs  
**Website:** http://127.0.0.1:8787 (source README has setup)  
**Repo:** https://github.com/moscraciunxxx/aphelion  
**Demo video:** https://youtu.be/t0M8Obykp84 (Unlisted)

## Inspiration

Prior Midnight gallery work hides salaries, ballots, or KYC badges. None of them treat the sky as the secret. Multi-messenger astronomy already embargoes localizations and treats strain as proprietary. Aphelion is the instrument that can say “a detection happened” on a public ledger without handing a rival the coordinates.

## What it does

An accredited observatory issues an attestation (private instrument secret → public root). An observer files a Compact circuit that proves:

- the instrument is accredited
- private milli-SNR is at or above the public band floor
- sky hash and strain hash are bound into the proof
- the nullifier for (observer, epoch) is unspent

The public ledger stores only instrument class, SNR band, epoch, nullifier, status, and the contract tag. RA, Dec, raw samples, and both secrets are witnesses. They never appear in the public JSON.

The viewport is a general-relativistic thin-disk / photon-ring renderer. Mass, spin, and distance change the image and the private photometry the circuit consumes.

## How we built it

- `contract/aphelion.compact` compiled with Compact 0.31.1 (`fileDetection`, `issueInstrument`, `confirmDetection` circuits + witnesses)
- Node bindings in `src/circuit.js` — the functions the backend and `npm run demo` actually call
- `src/physics.js` produces private strain and SNR
- `server/index.js` + `public/` full-stack UI
- Tests drive those shipped functions (valid witness, low SNR, bad secret, spent nullifier, no secret leakage)

## How Midnight enables the solution

Compact’s witness / `disclose` / nullifier model is the product. A transparent chain cannot carry a detection without leaking the sky. Midnight can, because the proof is generated locally and only disclosed fields hit the ledger. See `docs/HOW_MIDNIGHT.md`.

## Challenges

Official Preview/PreProd eligibility wants a live deploy plus a Docker proof-server. This machine has the Compact compiler and compiled ZKIR; it does not have Docker. The writeup does not invent a contract address.

## Accomplishments

A real Compact contract that is not a bulletin board. A photon-ring instrument that is not a stock chart. Tests that fail a lying witness.

## What we learned

`spent.member(nullifier)` is a ledger read of a witness-tainted hash — Compact requires `disclose` before the map sees it. That compiler error is the privacy model working.

## What's next

Proof-server deploy to PreProd the moment Docker is available; multi-observatory coincidence without sharing pointing.

## Setup

```
npm test
npm start
# http://127.0.0.1:8787
npm run demo
```
