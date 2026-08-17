# APHELION

**Prove the detection. Keep the sky.**

Aphelion is a sealed observatory on [Midnight](https://midnight.network/). A Compact circuit lets a consortium learn only that an accredited instrument saw a signal above a public SNR band. Right ascension, declination, raw strain, the observer, and the instrument secret stay in the witness. They are never written to the public ledger.

Source: https://github.com/moscraciunxxx/aphelion

The viewport is the instrument: a general-relativistic thin-disk / photon-ring renderer. Changing mass, spin, or distance moves the disk you see and the private photometry the circuit consumes.

This is not a bulletin-board tutorial, not a wallet badge, and not a reskin of `example-bboard`.

## Why Midnight

Public ledgers are too transparent for astronomy. Localizations can be embargoed. Strain is proprietary. Pointing can be dual-use. Midnight is the only chain in this hackathon whose **witness + `disclose` + nullifier** model is the product: the proof is why a public ledger can carry a detection at all.

## Setup

Requires Node 22+. The Compact compiler is optional for the local demo (the Node bindings the backend actually calls are tested). A Preview/PreProd deploy also needs Docker (proof server) and tNIGHT.

```bash
npm test
npm start
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787). Do not open `public/index.html` as `file://`.

Representative circuit (same entry the logs use):

```bash
npm run demo
```

Compile the Compact contract (compiler 0.31.1):

```bash
npm run compile
# proving keys: APHELION_SKIP_ZK=0 npm run compile
```

Attempt Preview/PreProd (honest failure is logged, never faked):

```bash
npm run deploy
```

## Circuits

| Circuit | Private witness | Public disclose |
|---|---|---|
| `issueInstrument` | instrument secret | attestation root, instrument class, SNR floor band |
| `fileDetection` | observer secret, sky hash, strain hash, milli-SNR, instrument secret | nullifier, class, band, epoch, status |
| `confirmDetection` | — | status = CONFIRMED |

`skyHash`, `strainHash`, `snrMilli`, and both secrets are **not** ledger fields.

## Problem

Multi-messenger follow-up needs a public “something was seen” without handing every rival, journalist, or adversary the sky. Aphelion files that sentence on Midnight.

## License

Apache-2.0
