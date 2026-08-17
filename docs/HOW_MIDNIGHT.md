# How Midnight enables Aphelion

A detection is a sentence about the universe. The coordinates, the strain, and the person who reduced the data are not that sentence. On a transparent chain those three leak the moment you post a claim. On Midnight they stay in the **witness**.

1. The observatory keeps an `instrumentSecret` in private state and publishes only `persistentHash("aphelion:at:" || class || band || secret)` — the attestation root.
2. The observer circuit `fileDetection` proves, locally:
   - they know that secret (instrument is accredited);
   - private milli-SNR ≥ the accredited floor;
   - sky and strain hashes are bound into the circuit (`bindObservation`) so the proof is about a real observation, not an empty one;
   - the nullifier `H("aphelion:nf:" || epoch || observerSecret)` has not been spent.
3. `disclose` is used only for class, band, epoch, nullifier, and status. Compact refuses to write a witness-tainted value to the ledger without that annotation. Diagnosis of the sky never gets one.
4. The public ledger therefore cannot reconstruct RA/Dec, the time series, or the observer. A consortium can still see “instrument II, band 1, epoch 20260817, new nullifier” and confirm it.

That is not a wallet wrapper. The zero-knowledge proof is why the product can exist.

Solidity/EVM cannot do this without a separate proving stack bolted on. Midnight’s Compact circuits *are* the stack.
