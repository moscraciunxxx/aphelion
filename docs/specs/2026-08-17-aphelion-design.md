# Aphelion design — 2026-08-17

Sealed observatory. Compact contract `contract/aphelion.compact`. Node bindings in `src/circuit.js` are what the server and CLI call. Physics in `src/physics.js` produce private strain and SNR. UI is a photon-ring instrument plus two panes: witness vs ledger.

Circuits: `issueInstrument`, `fileDetection`, `confirmDetection`. Fail closed on bad attestation, low SNR, spent nullifier. Public state has no sky, strain, or secrets.
